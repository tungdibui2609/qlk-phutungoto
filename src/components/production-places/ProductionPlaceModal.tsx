'use client'

import { useState, useEffect } from 'react'
import { X, Save, Factory, MapPin, User, Phone, CheckCircle2, FileText, Award, Layers, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ProductionPlace, ProductionPlaceInsert } from '@/app/(dashboard)/production-places/types'
import { VIETNAM_PROVINCES } from '@/lib/provinces'

type ProductionPlaceModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: (savedPlace?: ProductionPlace) => void
    initialData?: ProductionPlace | null
}

const COMMON_CERTS = [
    'HACCP Codex 2020',
    'ISO 22000:2018',
    'BRC Global Standard',
    'FDA Registration (USA)',
    'GlobalGAP CoC',
    'Tiêu chuẩn cơ sở đạt chuẩn'
]

export default function ProductionPlaceModal({ isOpen, onClose, onSuccess, initialData }: ProductionPlaceModalProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<ProductionPlaceInsert>>({
        code: '',
        name: '',
        address: '',
        location: '',
        province: '',
        contact_person: '',
        phone: '',
        capacity: '',
        certification: '',
        notes: '',
        is_active: true
    })

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code || '',
                name: initialData.name || '',
                address: initialData.address || '',
                location: initialData.location || '',
                province: initialData.province || '',
                contact_person: initialData.contact_person || '',
                phone: initialData.phone || '',
                capacity: initialData.capacity || '',
                certification: initialData.certification || '',
                notes: initialData.notes || '',
                is_active: initialData.is_active ?? true
            })
        } else {
            setFormData({
                code: '',
                name: '',
                address: '',
                location: '',
                province: '',
                contact_person: '',
                phone: '',
                capacity: '',
                certification: '',
                notes: '',
                is_active: true
            })
        }
        setError(null)
    }, [initialData, isOpen])

    // Sinh mã tự động
    const generateAutoCode = async () => {
        try {
            const prefix = 'NSX'
            const rand = Math.floor(1000 + Math.random() * 9000)
            const newCode = `${prefix}-${rand}`
            setFormData(prev => ({ ...prev, code: newCode }))
        } catch (e) {
            console.error('Error generating code', e)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!formData.name?.trim()) {
            setError('Vui lòng nhập tên nơi sản xuất / nhà máy')
            return
        }

        setLoading(true)
        try {
            const payload: any = {
                code: formData.code?.trim() || null,
                name: formData.name.trim(),
                address: formData.address?.trim() || null,
                location: formData.location?.trim() || null,
                province: formData.province?.trim() || null,
                contact_person: formData.contact_person?.trim() || null,
                phone: formData.phone?.trim() || null,
                capacity: formData.capacity?.trim() || null,
                certification: formData.certification?.trim() || null,
                notes: formData.notes?.trim() || null,
                is_active: formData.is_active ?? true,
                system_code: currentSystem?.code || null,
                company_id: profile?.company_id || null,
                updated_at: new Date().toISOString()
            }

            if (initialData?.id && !initialData.id.startsWith('place-')) {
                // Cập nhật
                const { data, error: updateError } = await (supabase.from('production_places' as any) as any)
                    .update(payload)
                    .eq('id', initialData.id)
                    .select()
                    .single()

                if (updateError) throw updateError
                showToast('Cập nhật nơi sản xuất thành công', 'success')
                onSuccess(data)
            } else {
                // Tạo mới (hoặc nếu là dữ liệu mẫu fallback chưa có trong DB)
                const { data, error: insertError } = await (supabase.from('production_places' as any) as any)
                    .insert([payload])
                    .select()
                    .single()

                if (insertError) throw insertError
                showToast('Thêm mới nơi sản xuất thành công', 'success')
                onSuccess(data)
            }
            onClose()
        } catch (err: any) {
            console.error('Save production place failed:', err)
            const errorMsg = err?.message || err?.error_description || (typeof err === 'object' && Object.keys(err).length > 0 ? JSON.stringify(err) : 'Lỗi khi lưu dữ liệu')
            setError(errorMsg)
            showToast('Lỗi: ' + errorMsg, 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-blue-100 dark:border-zinc-800">
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-blue-50/60 to-indigo-50/40 dark:from-blue-950/20 dark:to-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Factory size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                                {initialData ? 'Chỉnh sửa Nơi sản xuất' : 'Khai báo Nơi sản xuất / Nhà máy'}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Quản lý cơ sở chế biến, nhà máy đóng gói và địa điểm sản xuất lô hàng
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 flex-1">
                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Hàng 1: Mã & Tên nơi sản xuất */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    Mã cơ sở / Nhà máy
                                </label>
                                {!initialData && (
                                    <button
                                        type="button"
                                        onClick={generateAutoCode}
                                        className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
                                    >
                                        <Sparkles size={11} /> Tự sinh
                                    </button>
                                )}
                            </div>
                            <input
                                type="text"
                                value={formData.code || ''}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                placeholder="VD: NM-BT-01"
                                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Tên nơi sản xuất / Nhà máy <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="VD: Nhà máy Chánh Thu - Bến Tre"
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Hàng 2: Tỉnh thành & Địa chỉ */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Tỉnh / Thành phố
                            </label>
                            <select
                                value={formData.province || ''}
                                onChange={e => setFormData({ ...formData, province: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            >
                                <option value="">-- Chọn tỉnh thành --</option>
                                {VIETNAM_PROVINCES.map(p => (
                                    <option key={p.code} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Địa chỉ cụ thể / Khu công nghiệp
                            </label>
                            <input
                                type="text"
                                value={formData.address || ''}
                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                placeholder="VD: Ấp Mỹ Thạnh, Xã Mỹ Thạnh, Huyện Giồng Trôm"
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Hàng 3: Người liên hệ & Số điện thoại & Công suất */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Người phụ trách / Quản đốc
                            </label>
                            <input
                                type="text"
                                value={formData.contact_person || ''}
                                onChange={e => setFormData({ ...formData, contact_person: e.target.value })}
                                placeholder="VD: Nguyễn Văn A"
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Số điện thoại
                            </label>
                            <input
                                type="text"
                                value={formData.phone || ''}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="VD: 0912345678"
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                                Công suất thiết kế
                            </label>
                            <input
                                type="text"
                                value={formData.capacity || ''}
                                onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                placeholder="VD: 50 tấn/ngày"
                                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Hàng 4: Chứng chỉ chất lượng */}
                    <div>
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                            Tiêu chuẩn chứng nhận / Chứng chỉ nhà máy
                        </label>
                        <input
                            type="text"
                            value={formData.certification || ''}
                            onChange={e => setFormData({ ...formData, certification: e.target.value })}
                            placeholder="Gõ hoặc chọn nhanh bên dưới: HACCP, ISO 22000, FDA..."
                            className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none mb-2"
                        />
                        <div className="flex flex-wrap gap-1.5">
                            {COMMON_CERTS.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                        const cur = formData.certification || ''
                                        if (!cur.includes(c)) {
                                            setFormData({
                                                ...formData,
                                                certification: cur ? `${cur}, ${c}` : c
                                            })
                                        }
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-colors"
                                >
                                    + {c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hàng 5: Ghi chú & Trạng thái */}
                    <div>
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                            Ghi chú bổ sung
                        </label>
                        <textarea
                            rows={2}
                            value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Thông tin quy mô xưởng, dây chuyền bóc múi / đông lạnh..."
                            className="w-full px-3.5 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active ?? true}
                            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-zinc-300"
                        />
                        <label htmlFor="is_active" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                            Kích hoạt sử dụng cơ sở sản xuất này
                        </label>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            <Save size={15} />
                            <span>{loading ? 'Đang lưu...' : (initialData ? 'Cập nhật' : 'Lưu cơ sở')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
