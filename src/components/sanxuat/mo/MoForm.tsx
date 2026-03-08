'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Search, Check, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

// Select dropdown for BOMs
const BomSelect = ({ value, onChange, placeholder }: any) => {
    const [boms, setBoms] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        async function fetchBoms() {
            let query = supabase.from('boms' as any).select('id, name, code, quantity, products!boms_product_id_fkey(id, name, unit)').limit(50)
            if (search) {
                query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`)
            }
            const { data } = await query
            if (data) setBoms(data)
        }
        const delay = setTimeout(fetchBoms, 300)
        return () => clearTimeout(delay)
    }, [search])

    const selectedBom = boms.find(p => p.id === value?.id) || value

    return (
        <div className="relative">
            <div
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 flex items-center justify-between cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="truncate">
                    {selectedBom ? (
                        <>
                            <span className="font-medium">{selectedBom.code ? `[${selectedBom.code}] ` : ''}{selectedBom.name}</span>
                            <span className="text-zinc-500 text-sm ml-2">({selectedBom.products?.name})</span>
                        </>
                    ) : placeholder}
                </div>
                <ChevronDown size={16} className="text-zinc-400 shrink-0 ml-2" />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <div className="sticky top-0 p-2 bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
                        <input
                            type="text"
                            placeholder="Tìm định mức..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-100 dark:bg-zinc-900 border-none outline-none"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="p-1">
                        {boms.length === 0 ? (
                            <div className="p-3 text-center text-zinc-500 text-sm">Không tìm thấy định mức</div>
                        ) : (
                            boms.map(b => (
                                <div
                                    key={b.id}
                                    className={`p-3 rounded-lg flex items-center justify-between cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700 ${value?.id === b.id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-200'}`}
                                    onClick={() => {
                                        onChange(b)
                                        setIsOpen(false)
                                        setSearch('')
                                    }}
                                >
                                    <div>
                                        <p className="font-medium text-sm line-clamp-1">{b.name}</p>
                                        <p className="text-xs opacity-70">Tạo ra: {b.quantity} {b.products?.unit} {b.products?.name}</p>
                                    </div>
                                    {value?.id === b.id && <Check size={16} />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function MoForm({ initialData, isEditMode = false }: { initialData?: any, isEditMode?: boolean }) {
    const router = useRouter()
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const [saving, setSaving] = useState(false)

    // Ensure we have a default code for new form
    const randomCode = `MO-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

    const [formData, setFormData] = useState({
        code: initialData?.code || randomCode,
        bom: initialData?.bom_id ? { id: initialData.bom_id, name: initialData.boms?.name, products: initialData.products } : null,
        target_quantity: initialData?.target_quantity || 1,
        status: initialData?.status || 'DRAFT',
        start_date: initialData?.start_date ? new Date(initialData.start_date).toISOString().split('T')[0] : '',
        end_date: initialData?.end_date ? new Date(initialData.end_date).toISOString().split('T')[0] : '',
        notes: initialData?.notes || ''
    })

    const handleBomSelect = (bom: any) => {
        // If user changes BOM, update target quantity to BOM base quantity as default
        setFormData({
            ...formData,
            bom: bom,
            target_quantity: bom.quantity
        })
    }

    const validate = () => {
        if (!formData.code.trim()) return 'Mã Lệnh không được để trống'
        if (!formData.bom) return 'Vui lòng chọn Định mức (BOM)'
        if (formData.target_quantity <= 0) return 'Số lượng sản xuất phải lớn hơn 0'
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
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Không lấy được phiên đăng nhập')
            const { data: profile } = await supabase.from('user_profiles').select('company_id').eq('id', user.id).single()

            const payload = {
                code: formData.code,
                bom_id: formData.bom!.id,
                product_id: formData.bom!.products?.id, // Product is derived from BOM
                target_quantity: formData.target_quantity,
                status: formData.status,
                start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
                end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
                notes: formData.notes,
                system_code: systemType,
                company_id: profile?.company_id,
                updated_at: new Date().toISOString()
            }

            if (isEditMode && initialData?.id) {
                const { error } = await supabase.from('manufacturing_orders' as any).update(payload).eq('id', String(initialData.id))
                if (error) throw error
                showToast('Cập nhật Lệnh Sản Xuất thành công!', 'success')
            } else {
                const { error } = await supabase.from('manufacturing_orders' as any).insert(payload)
                if (error) throw error
                showToast('Tạo Lệnh Sản Xuất thành công!', 'success')
            }

            router.push('/sanxuat/mo')
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
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Mã lệnh (Tự động hoặc Nhập tay) <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-zinc-800 dark:text-zinc-100 uppercase"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Trạng thái</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none font-medium appearance-none"
                        >
                            <option value="DRAFT">Nháp (Draft)</option>
                            <option value="PLANNED">Đã lên kế hoạch (Planned)</option>
                            <option value="IN_PROGRESS">Đang sản xuất (In Progress)</option>
                            <option value="DONE">Hoàn thành (Done)</option>
                            <option value="CANCELED">Đã hủy (Canceled)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Định mức sản xuất (BOM) <span className="text-rose-500">*</span></label>
                        <BomSelect
                            value={formData.bom}
                            onChange={handleBomSelect}
                            placeholder="Chọn Công thức/Định mức sản xuất..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Số lượng Cần Làm <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={formData.target_quantity}
                                onChange={e => setFormData({ ...formData, target_quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none pr-16 text-right font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 font-medium">
                                {formData.bom?.products?.unit || 'Loại'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ngày dự kiến bắt đầu</label>
                        <input
                            type="date"
                            value={formData.start_date}
                            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ngày dự kiến kết thúc</label>
                        <input
                            type="date"
                            value={formData.end_date}
                            onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Ghi chú thêm</label>
                    <textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Yêu cầu đặc biệt cho mẻ sản xuất này..."
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[100px]"
                    />
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
                    {saving ? 'Đang lưu...' : 'Lưu Lệnh Sản Xuất'}
                </button>
            </div>
        </div>
    )
}
