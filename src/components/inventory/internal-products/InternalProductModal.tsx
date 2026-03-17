'use client'
import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { Database } from '@/lib/database.types'
import { X, Save, Box, Info, AlertTriangle } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

type Product = Database['public']['Tables']['products']['Row']
type CodeRule = {
    id: string
    level: number
    prefix: string
    description: string
}

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSuccess: () => void
}

export default function InternalProductModal({ open, onOpenChange, product, onSuccess }: Props) {
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(false)
    const [fetchingRules, setFetchingRules] = useState(false)
    
    // Form state
    const [internalCode, setInternalCode] = useState('')
    const [internalName, setInternalName] = useState('')
    const [lvl1Id, setLvl1Id] = useState<string>('')
    const [lvl2Id, setLvl2Id] = useState<string>('')
    const [lvl3Id, setLvl3Id] = useState<string>('')
    const [lvl4Id, setLvl4Id] = useState<string>('')

    // Rules state
    const [rules, setRules] = useState<CodeRule[]>([])

    // Load rules and initial data
    useEffect(() => {
        if (open) {
            fetchRules()
            if (product) {
                setInternalCode(product.internal_code || '')
                setInternalName(product.internal_name || product.name || '')
                setLvl1Id((product as any).internal_lvl1_id || '')
                setLvl2Id((product as any).internal_lvl2_id || '')
                setLvl3Id((product as any).internal_lvl3_id || '')
                setLvl4Id((product as any).internal_lvl4_id || '')
            }
        } else {
            setInternalCode('')
            setInternalName('')
            setLvl1Id('')
            setLvl2Id('')
            setLvl3Id('')
            setLvl4Id('')
        }
    }, [open, product, systemType])

    const fetchRules = async () => {
        setFetchingRules(true)
        try {
            const { data, error } = await supabase
                .from('internal_product_code_rules')
                .select('id, level, prefix, description')
                .eq('system_code', systemType)
                .order('sort_order', { ascending: true })

            if (error) throw error
            console.log(`[InternalProductModal] Fetched ${data?.length || 0} rules for system: ${systemType}`)
            setRules(data || [])
        } catch (error: any) {
            console.error(`[InternalProductModal] Fetch rules error for system: ${systemType}`, error)
            showToast('Lỗi khi tải quy tắc mã: ' + error.message, 'error')
        } finally {
            setFetchingRules(false)
        }
    }

    // Auto-generate internal code when levels change
    useEffect(() => {
        if (!open || fetchingRules) return

        const r1 = rules.find(r => r.id === lvl1Id)
        const r2 = rules.find(r => r.id === lvl2Id)
        const r3 = rules.find(r => r.id === lvl3Id)
        const r4 = rules.find(r => r.id === lvl4Id)

        const p1 = (r1?.prefix || '').toUpperCase()
        const p2 = (r2?.prefix || '').toUpperCase()
        const p3 = (r3?.prefix || '').toUpperCase()
        const p4 = (r4?.prefix || '').toUpperCase()

        const generatedCode = `${p1}${p2}${p3}${p4}`.trim()
        if (generatedCode) {
            setInternalCode(generatedCode)
        }
    }, [lvl1Id, lvl2Id, lvl3Id, lvl4Id, rules])

    const handleSave = async () => {
        if (!product) return

        setLoading(true)
        try {
            const normalizedCode = internalCode.trim().toUpperCase()
            
            // Check for duplicate internal_code
            if (normalizedCode) {
                const { data: existing, error: checkError } = await supabase
                    .from('products')
                    .select('id, name')
                    .eq('internal_code', normalizedCode)
                    .neq('id', product.id)
                    .maybeSingle()

                if (existing) {
                    showToast(`Mã "${normalizedCode}" đã được dùng cho sản phẩm: ${existing.name}`, 'error')
                    setLoading(false)
                    return
                }
            }

            const { error } = await supabase
                .from('products')
                .update({
                    internal_code: normalizedCode || null,
                    internal_name: internalName.trim() || null,
                    internal_lvl1_id: lvl1Id || null,
                    internal_lvl2_id: lvl2Id || null,
                    internal_lvl3_id: lvl3Id || null,
                    internal_lvl4_id: lvl4Id || null
                } as any)
                .eq('id', product.id)

            if (error) throw error

            showToast('Cập nhật thông tin nội bộ thành công', 'success')
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Update error:', error)
            showToast('Lỗi khi cập nhật: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    const lvl1Options = rules.filter(r => r.level === 1)
    const lvl2Options = rules.filter(r => r.level === 2)
    const lvl3Options = rules.filter(r => r.level === 3)
    const lvl4Options = rules.filter(r => r.level === 4)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-left">
            <div className="bg-white rounded-[24px] w-full max-w-6xl shadow-2xl flex flex-col overflow-hidden animate-slide-up border border-stone-100 max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                            <Box size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-stone-800 tracking-tight">Thiết lập mã nội bộ</h2>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{product?.sku}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8 flex-1 overflow-y-auto">
                    <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100">
                        <div className="flex justify-between items-start gap-4">
                            <div>
                                <p className="text-sm font-black text-indigo-900 leading-snug">{product?.name}</p>
                                <p className="text-[11px] text-indigo-500 mt-1 font-bold">Mã NSX: {product?.part_number || '---'}</p>
                            </div>
                            <div className="text-right">
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-white text-indigo-600 border border-indigo-100 shadow-sm">
                                    {product?.sku}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* 4 LEVELS SELECTION */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-1">Cấp 1: Sản phẩm</label>
                                <select
                                    value={lvl1Id}
                                    onChange={(e) => setLvl1Id(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-100 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-stone-700 text-sm appearance-none"
                                >
                                    <option value="">-- Chọn --</option>
                                    {lvl1Options.map(opt => (
                                        <option key={opt.id} value={opt.id}>[{opt.prefix}] {opt.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-1">Cấp 2: Hình thức</label>
                                <select
                                    value={lvl2Id}
                                    onChange={(e) => setLvl2Id(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-100 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-stone-700 text-sm appearance-none"
                                >
                                    <option value="">-- Chọn --</option>
                                    {lvl2Options.map(opt => (
                                        <option key={opt.id} value={opt.id}>[{opt.prefix}] {opt.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-1">Cấp 3: Phân loại</label>
                                <select
                                    value={lvl3Id}
                                    onChange={(e) => setLvl3Id(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-100 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-stone-700 text-sm appearance-none"
                                >
                                    <option value="">-- Chọn --</option>
                                    {lvl3Options.map(opt => (
                                        <option key={opt.id} value={opt.id}>[{opt.prefix}] {opt.description}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 px-1">Cấp 4: Dự phòng</label>
                                <select
                                    value={lvl4Id}
                                    onChange={(e) => setLvl4Id(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-stone-50 border border-stone-100 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all font-bold text-stone-700 text-sm appearance-none"
                                >
                                    <option value="">-- Chọn --</option>
                                    {lvl4Options.map(opt => (
                                        <option key={opt.id} value={opt.id}>[{opt.prefix}] {opt.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* GENERATED CODE */}
                        <div className="bg-stone-900 rounded-[28px] p-6 text-white shadow-xl shadow-stone-200">
                            <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-3">Mã nội bộ tự động sinh</label>
                            <div className="flex items-center gap-3">
                                <div className="text-3xl font-mono font-black tracking-tighter text-indigo-400">
                                    {internalCode || '---'}
                                </div>
                                {!internalCode && (
                                    <div className="flex items-center gap-2 text-stone-500 animate-pulse">
                                        <Info size={14} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Chưa có lựa chọn</span>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-4 border-t border-white/5 flex gap-4">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5">Tên hiển thị nội bộ</label>
                                    <input
                                        type="text"
                                        value={internalName}
                                        onChange={(e) => setInternalName(e.target.value)}
                                        placeholder="VD: Sầu Dona Má Loại A"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:border-white/20 transition-all font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                <strong>Lưu ý:</strong> Hệ thống sẽ tự động nối các mã (Prefix) của 3 cấp độ để tạo thành mã định danh duy nhất. Bạn có thể chỉnh sửa tên hiển thị cho phù hợp với cách gọi tại xưởng.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 bg-stone-50 border-t border-stone-100 flex justify-end gap-3">
                    <button
                        onClick={() => onOpenChange(false)}
                        className="px-6 py-3 rounded-2xl text-stone-400 font-black uppercase tracking-widest hover:bg-stone-200 transition-all text-[11px]"
                        disabled={loading}
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || fetchingRules}
                        className="flex items-center gap-3 px-10 py-3 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 active:scale-95 transition-all text-[11px] shadow-lg shadow-indigo-200 disabled:opacity-50"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Lưu cấu hình
                    </button>
                </div>
            </div>
        </div>
    )
}
