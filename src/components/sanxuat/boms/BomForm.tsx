'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Save, X, Search, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

interface BomFormProps {
    initialData?: any
    initialLines?: any[]
    isEditMode?: boolean
}

// A simple searchable product select component
const ProductSelect = ({ value, onChange, placeholder, excludeIds = [] }: any) => {
    const [products, setProducts] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const { systemType } = useSystem()

    useEffect(() => {
        async function fetchProducts() {
            let query = supabase.from('products').select('id, name, sku, unit, internal_name, internal_code').limit(50)
            if (search) {
                query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,internal_name.ilike.%${search}%`)
            }
            const { data } = await query
            if (data) setProducts(data)
        }
        const delay = setTimeout(fetchProducts, 300)
        return () => clearTimeout(delay)
    }, [search])

    const selectedProduct = products.find(p => p.id === value?.id) || value

    return (
        <div className="relative">
            <div
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-between cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedProduct?.name || placeholder}</span>
                <Search size={16} className="text-zinc-400 shrink-0 ml-2" />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <div className="sticky top-0 p-2 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
                        <input
                            type="text"
                            placeholder="Tìm kiếm SP..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-900 border-none outline-none"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="p-1">
                        {products.filter(p => !excludeIds.includes(p.id)).length === 0 ? (
                            <div className="p-3 text-center text-zinc-500 text-sm">Không tìm thấy sản phẩm</div>
                        ) : (
                            products.filter(p => !excludeIds.includes(p.id)).map(p => (
                                <div
                                    key={p.id}
                                    className={`p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 ${value?.id === p.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-200'}`}
                                    onClick={() => {
                                        onChange(p)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                >
                                    <div>
                                        <p className="font-medium text-sm line-clamp-1">{p.name}</p>
                                        <p className="text-xs opacity-70">{p.sku || p.internal_code || '---'} {p.unit ? `(${p.unit})` : ''}</p>
                                    </div>
                                    {value?.id === p.id && <Check size={16} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function BomForm({ initialData, initialLines = [], isEditMode = false }: BomFormProps) {
    const router = useRouter()
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const [saving, setSaving] = useState(false)

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        code: initialData?.code || '',
        product: initialData?.products || null,
        quantity: initialData?.quantity || 1,
        notes: initialData?.notes || ''
    })

    const [lines, setLines] = useState<any[]>(
        initialLines.map(line => ({
            id: line.id || crypto.randomUUID(),
            material: line.products || null,
            quantity: line.quantity || 1,
            unit: line.unit || '',
            scrap_percentage: line.scrap_percentage || 0,
            notes: line.notes || ''
        }))
    )

    const handleAddLine = () => {
        setLines([...lines, {
            id: crypto.randomUUID(),
            material: null,
            quantity: 1,
            unit: '',
            scrap_percentage: 0,
            notes: ''
        }])
    }

    const handleRemoveLine = (id: string) => {
        setLines(lines.filter(l => l.id !== id))
    }

    const handleLineChange = (id: string, field: string, value: any) => {
        setLines(lines.map(l => {
            if (l.id === id) {
                const updated = { ...l, [field]: value }
                if (field === 'material' && value) {
                    updated.unit = value.unit || ''
                }
                return updated
            }
            return l
        }))
    }

    const validate = () => {
        if (!formData.name.trim()) return 'Tên định mức không được để trống'
        if (!formData.product) return 'Vui lòng chọn Thành phẩm'
        if (formData.quantity <= 0) return 'Số lượng thành phẩm phải lớn hơn 0'
        if (lines.length === 0) return 'Phải có ít nhất 1 nguyên vật liệu'

        for (let i = 0; i < lines.length; i++) {
            if (!lines[i].material) return `Dòng ${i + 1}: Vui lòng chọn Nguyên liệu`
            if (lines[i].quantity <= 0) return `Dòng ${i + 1}: Số lượng phải lớn hơn 0`
        }
        return null
    }

    const handleSave = async () => {
        const err = validate()
        if (err) {
            showToast(err, 'error')
            return
        }

        setSaving(true)
        try {
            // Get user's company_id
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Không lấy được phiên đăng nhập')
            const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()
            const companyId = profile?.company_id

            // 1. Save BOM
            const bomPayload = {
                name: formData.name,
                code: formData.code,
                product_id: formData.product.id,
                quantity: formData.quantity,
                notes: formData.notes,
                system_code: systemType,
                company_id: companyId,
                updated_at: new Date().toISOString()
            }

            let bomId = initialData?.id

            if (isEditMode) {
                const { error: bomErr } = await supabase.from('boms' as any).update(bomPayload).eq('id', bomId)
                if (bomErr) throw bomErr
            } else {
                const { data: newBom, error: bomErr } = await supabase.from('boms' as any).insert(bomPayload).select().single()
                if (bomErr) throw bomErr
                bomId = (newBom as any).id
            }

            // 2. Save BOM Lines
            // Simple approach: Delete all existing lines and insert new ones
            if (isEditMode) {
                await supabase.from('bom_lines' as any).delete().eq('bom_id', bomId)
            }

            const linesPayload = lines.map(l => ({
                bom_id: bomId,
                material_id: l.material.id,
                quantity: l.quantity,
                unit: l.unit,
                scrap_percentage: l.scrap_percentage || 0,
                notes: l.notes,
                company_id: companyId
            }))

            if (linesPayload.length > 0) {
                const { error: linesErr } = await supabase.from('bom_lines' as any).insert(linesPayload)
                if (linesErr) throw linesErr
            }

            showToast(isEditMode ? 'Cập nhật định mức thành công!' : 'Tạo mới định mức thành công!', 'success')
            router.push('/sanxuat/boms')
            router.refresh()
        } catch (error: any) {
            console.error(error)
            showToast('Lỗi khi lưu: ' + error.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header / Main Info */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center text-sm">1</span>
                    Thông tin Chung
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Tên định mức <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="VD: Xoài sấy 500g tiêu chuẩn"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Mã định mức (Tùy chọn)</label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            placeholder="VD: BOM-XOAI-001"
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none uppercase"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Thành phẩm tạo ra <span className="text-rose-500">*</span></label>
                        <ProductSelect
                            value={formData.product}
                            onChange={(p: any) => setFormData({ ...formData, product: p })}
                            placeholder="Chọn sản phẩm thành phẩm..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Số lượng (Base) <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none pr-16 text-right font-mono"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">
                                {formData.product?.unit || 'Loại'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ghi chú (Tùy chọn)</label>
                    <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Mô tả thêm về quy trình, nhiệt độ, thông số sấy..."
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                    />
                </div>
            </div>

            {/* BOM Lines */}
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center text-sm">2</span>
                        Nguyên Vật Liệu
                    </h2>
                    <button
                        onClick={handleAddLine}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
                    >
                        <Plus size={18} /> Thêm NVL
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-sm font-semibold text-zinc-500">
                                <th className="py-3 px-2 w-[40%]">Sản phẩm / Nguyên liệu</th>
                                <th className="py-3 px-2 w-[20%] text-right">Số lượng tiêu hao</th>
                                <th className="py-3 px-2 w-[15%] text-right">% Hao hụt dự kiến</th>
                                <th className="py-3 px-2 w-[20%]">Ghi chú</th>
                                <th className="py-3 px-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                            {lines.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                                        Chưa có nguyên vật liệu nào. Bấm nút "Thêm NVL" để bắt đầu.
                                    </td>
                                </tr>
                            ) : (
                                lines.map((line, idx) => (
                                    <tr key={line.id} className="group">
                                        <td className="py-3 px-2 relative z-10">
                                            <ProductSelect
                                                value={line.material}
                                                onChange={(p: any) => handleLineChange(line.id, 'material', p)}
                                                placeholder="Chọn NVL..."
                                                excludeIds={formData.product ? [formData.product.id] : []} // Can't use finish good directly in BOM
                                            />
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0.001"
                                                    step="any"
                                                    value={line.quantity}
                                                    onChange={e => handleLineChange(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none pr-12 text-right font-mono text-sm"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">
                                                    {line.unit || '---'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    step="any"
                                                    value={line.scrap_percentage}
                                                    onChange={e => handleLineChange(line.id, 'scrap_percentage', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none pr-8 text-right font-mono text-sm"
                                                />
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs font-bold">
                                                    %
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-2">
                                            <input
                                                type="text"
                                                value={line.notes}
                                                onChange={e => handleLineChange(line.id, 'notes', e.target.value)}
                                                placeholder="VD: Cắt nhỏ..."
                                                className="w-full px-3 py-2 rounded-lg border border-transparent bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:bg-white focus:border-zinc-200 dark:focus:border-zinc-700 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition"
                                            />
                                        </td>
                                        <td className="py-3 px-2 text-right">
                                            <button
                                                onClick={() => handleRemoveLine(line.id)}
                                                className="p-2 text-zinc-400 hover:text-rose-500 transition opacity-0 group-hover:opacity-100 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Actions */}
            <div className="fixed bottom-0 left-0 right-0 md:left-64 p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 z-40">
                <button
                    onClick={() => router.back()}
                    className="px-6 py-2.5 rounded-xl font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                    Hủy bỏ
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                >
                    {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    {saving ? 'Đang lưu...' : 'Lưu Định mức'}
                </button>
            </div>
        </div>
    )
}
