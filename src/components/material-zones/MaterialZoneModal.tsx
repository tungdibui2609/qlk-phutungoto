'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Save, MapPin, Tag, User, Phone, CheckCircle2, FileText, Layers, Award, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { MaterialZone, MaterialZoneInsert } from '@/app/(dashboard)/material-zones/types'
import { VIETNAM_PROVINCES, findProvince, getProvinceCode } from '@/lib/provinces'

type MaterialZoneModalProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess: (savedZone?: MaterialZone) => void
    initialData?: MaterialZone | null
}

const COMMON_CERTS = [
    'Mã số PUC xuất khẩu',
    'VietGAP',
    'GlobalGAP',
    'Hữu cơ (Organic)',
    'Tiêu chuẩn nội địa',
    'Đang kiểm định'
]

export default function MaterialZoneModal({ isOpen, onClose, onSuccess, initialData }: MaterialZoneModalProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<MaterialZoneInsert>>({
        code: '',
        name: '',
        location: '',
        province: '',
        area_ha: undefined,
        farmer_name: '',
        phone: '',
        certification: '',
        notes: '',
        is_active: true
    })

    // Xác định mã tỉnh hành chính hiện tại dựa trên tỉnh đang chọn
    const currentProvinceObj = useMemo(() => {
        if (!formData.province) return undefined
        return findProvince(formData.province)
    }, [formData.province])

    const currentProvinceCode = currentProvinceObj?.code || null

    useEffect(() => {
        if (initialData) {
            setFormData({
                code: initialData.code || '',
                name: initialData.name || '',
                location: initialData.location || '',
                province: initialData.province || '',
                area_ha: initialData.area_ha ?? undefined,
                farmer_name: initialData.farmer_name || '',
                phone: initialData.phone || '',
                certification: initialData.certification || '',
                notes: initialData.notes || '',
                is_active: initialData.is_active ?? true
            })
        } else {
            setFormData({
                code: '',
                name: '',
                location: '',
                province: '',
                area_ha: undefined,
                farmer_name: '',
                phone: '',
                certification: '',
                notes: '',
                is_active: true
            })
        }
        setError(null)
    }, [initialData, isOpen])

    // Khi chọn tỉnh thành phố -> Tự động cập nhật tiền tố mã theo mã hành chính tỉnh
    const handleProvinceChange = (provinceInput: string) => {
        const found = findProvince(provinceInput)
        const provinceName = found ? found.name : provinceInput
        const provCode = found ? found.code : null

        setFormData(prev => {
            let nextCode = prev.code || ''
            if (provCode) {
                // Nếu chưa có mã, hoặc mã đang theo dạng tiền tố mã tỉnh cũ
                if (!nextCode || /^VN-\d{2}-/i.test(nextCode) || /^\d{2}-/.test(nextCode)) {
                    const suffix = nextCode.replace(/^(VN-)?\d{2}-?/i, '')
                    nextCode = `VN-${provCode}-${suffix}`
                }
            }
            return {
                ...prev,
                province: provinceName,
                code: nextCode
            }
        })
    }

    // Tự động sinh mã vùng trồng tiếp theo theo mã tỉnh hành chính
    const handleAutoGenerateCode = async () => {
        if (!currentProvinceCode) {
            showToast('Vui lòng chọn Tỉnh/Thành phố trước để xác định mã hành chính', 'warning')
            return
        }

        setIsGeneratingCode(true)
        try {
            // Truy vấn các mã vùng trồng đã có của tỉnh này
            const { data } = await (supabase.from('material_zones' as any) as any)
                .select('code')
                .or(`code.ilike.VN-${currentProvinceCode}-%,code.ilike.${currentProvinceCode}-%`)

            let maxSeq = 0
            if (data && data.length > 0) {
                data.forEach((item: any) => {
                    if (item.code) {
                        const parts = item.code.split('-')
                        const lastNum = parseInt(parts[parts.length - 1], 10)
                        if (!isNaN(lastNum) && lastNum > maxSeq) {
                            maxSeq = lastNum
                        }
                    }
                })
            }

            const nextSeq = String(maxSeq + 1).padStart(2, '0')
            const isDirectPrefix = !!formData.code?.startsWith(`${currentProvinceCode}-`) && !formData.code?.startsWith('VN-')
            const generatedCode = isDirectPrefix 
                ? `${currentProvinceCode}-${nextSeq}`
                : `VN-${currentProvinceCode}-${nextSeq}`

            setFormData(prev => ({
                ...prev,
                code: generatedCode
            }))
            showToast(`Đã sinh mã theo mã tỉnh ${currentProvinceCode} (${currentProvinceObj?.shortName}): ${generatedCode}`, 'success')
        } catch (err) {
            const fallbackCode = `VN-${currentProvinceCode}-01`
            setFormData(prev => ({
                ...prev,
                code: fallbackCode
            }))
        } finally {
            setIsGeneratingCode(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name?.trim()) {
            setError('Vui lòng nhập tên vùng trồng / vùng nguyên liệu')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const payload: any = {
                code: formData.code?.trim() || null,
                name: formData.name.trim(),
                location: formData.location?.trim() || null,
                province: formData.province?.trim() || null,
                area_ha: formData.area_ha ? Number(formData.area_ha) : null,
                farmer_name: formData.farmer_name?.trim() || null,
                phone: formData.phone?.trim() || null,
                certification: formData.certification?.trim() || null,
                notes: formData.notes?.trim() || null,
                is_active: formData.is_active ?? true,
                system_code: currentSystem?.code || null,
                company_id: profile?.company_id || null,
                updated_at: new Date().toISOString()
            }

            let savedResult: MaterialZone | null = null

            if (initialData?.id) {
                const { data, error: updateError } = await (supabase.from('material_zones' as any) as any)
                    .update(payload)
                    .eq('id', initialData.id)
                    .select()
                    .single()

                if (updateError) throw updateError
                savedResult = data as MaterialZone
                showToast('Cập nhật vùng trồng thành công!', 'success')
            } else {
                const { data, error: insertError } = await (supabase.from('material_zones' as any) as any)
                    .insert([payload])
                    .select()
                    .single()

                if (insertError) throw insertError
                savedResult = data as MaterialZone
                showToast('Khai báo vùng trồng mới thành công!', 'success')
            }

            onSuccess(savedResult || undefined)

            // Tự động đồng bộ sang stamp_dictionaries (category: 'province') cho quy tắc đóng dấu
            try {
                const provCode = currentProvinceCode || 
                    (payload.code ? payload.code.replace(/[^0-9]/g, '').slice(0, 2) : null) || 
                    (payload.province ? getProvinceCode(payload.province) : null)

                const shortName = currentProvinceObj?.shortName || 
                    (payload.province ? payload.province.replace(/^(Tỉnh|Thành phố)\s+/i, '').trim() : '') || 
                    payload.name.replace(/^Vùng trồng\s+/i, '').trim()

                if (provCode && shortName) {
                    const { data: existingDict } = await (supabase.from('stamp_dictionaries' as any) as any)
                        .select('id, code, name')
                        .eq('category', 'province')

                    const matchDict = existingDict?.find((d: any) => 
                        d.code === provCode || 
                        d.name.trim().toLowerCase() === shortName.toLowerCase()
                    )

                    if (matchDict) {
                        await (supabase.from('stamp_dictionaries' as any) as any)
                            .update({
                                code: provCode,
                                name: shortName,
                                description: `Tỉnh ${shortName}`,
                                is_active: payload.is_active ?? true,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', matchDict.id)
                    } else {
                        await (supabase.from('stamp_dictionaries' as any) as any)
                            .insert([{
                                category: 'province',
                                code: provCode,
                                name: shortName,
                                description: `Tỉnh ${shortName}`,
                                is_active: payload.is_active ?? true,
                                sort_order: (existingDict?.length || 0) + 1,
                                updated_at: new Date().toISOString()
                            }])
                    }
                }
            } catch (syncErr) {
                console.warn('Lỗi đồng bộ sang stamp_dictionaries từ material_zones:', syncErr)
            }

            onClose()
        } catch (err: any) {
            console.error('MaterialZone error:', err)
            setError(err.message || 'Có lỗi xảy ra khi lưu vùng trồng')
            showToast('Lỗi: ' + (err.message || 'Không thể lưu'), 'error')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4.5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center bg-emerald-50/40 dark:bg-emerald-950/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                            <MapPin size={22} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                                {initialData ? 'Chỉnh sửa Vùng Trồng' : 'Khai báo Vùng Trồng Mới'}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Quản lý mã số vùng trồng PUC chuẩn mã hành chính tỉnh để truy xuất nguồn gốc
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
                    {error && (
                        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-600 dark:text-rose-400 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Tỉnh / Thành phố (chọn trước để lấy mã hành chính) */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                    <MapPin size={13} className="text-blue-500" />
                                    <span>Tỉnh / Thành phố</span>
                                </label>
                                {currentProvinceCode && (
                                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                                        Mã HC: {currentProvinceCode}
                                    </span>
                                )}
                            </div>
                            <input
                                type="text"
                                list="provinces-list"
                                placeholder="Gõ tìm hoặc chọn Tỉnh..."
                                value={formData.province || ''}
                                onChange={(e) => handleProvinceChange(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                            <datalist id="provinces-list">
                                {VIETNAM_PROVINCES.map(p => (
                                    <option key={p.code} value={p.name}>
                                        Mã {p.code} - {p.name}
                                    </option>
                                ))}
                            </datalist>
                        </div>

                        {/* Mã vùng trồng / PUC */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                    <Tag size={13} className="text-emerald-600" />
                                    <span>Mã vùng trồng / PUC</span>
                                </label>
                                {currentProvinceCode && (
                                    <button
                                        type="button"
                                        onClick={handleAutoGenerateCode}
                                        disabled={isGeneratingCode}
                                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                                        title="Tự động lấy số tiếp theo theo mã tỉnh"
                                    >
                                        <Sparkles size={11} />
                                        <span>Sinh mã</span>
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder={currentProvinceCode ? `VD: VN-${currentProvinceCode}-01` : 'VD: VN-66-01...'}
                                    value={formData.code || ''}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                />
                            </div>

                            {/* Tiền tố gợi ý nhanh */}
                            {currentProvinceCode && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                    <span className="text-[10px] text-zinc-400 font-medium">Gợi ý:</span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, code: `VN-${currentProvinceCode}-` }))}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                                    >
                                        VN-{currentProvinceCode}-
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, code: `${currentProvinceCode}-` }))}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
                                    >
                                        {currentProvinceCode}-
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tên vùng trồng */}
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <MapPin size={13} className="text-emerald-600" />
                                Tên vùng trồng / Vùng nguyên liệu <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="VD: Vùng trồng Sầu riêng Cư M'gar, Vùng trồng Cai Lậy..."
                                value={formData.name || ''}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        {/* Diện tích (ha) */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Layers size={13} className="text-amber-500" />
                                Diện tích (Hecta - ha)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="VD: 15.5"
                                value={formData.area_ha ?? ''}
                                onChange={(e) => setFormData({ ...formData, area_ha: e.target.value ? parseFloat(e.target.value) : undefined })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        {/* Tiêu chuẩn chứng nhận */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Award size={13} className="text-purple-500" />
                                Tiêu chuẩn chứng nhận / Xuất khẩu
                            </label>
                            <input
                                type="text"
                                list="certs-list"
                                placeholder="VD: Mã số PUC xuất khẩu TQ, VietGAP..."
                                value={formData.certification || ''}
                                onChange={(e) => setFormData({ ...formData, certification: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                            <datalist id="certs-list">
                                {COMMON_CERTS.map(c => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                        </div>

                        {/* Chủ hộ / Đại diện / Hợp tác xã */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <User size={13} className="text-purple-500" />
                                Đại diện / Chủ vườn / HTX
                            </label>
                            <input
                                type="text"
                                placeholder="VD: HTX Sầu riêng Cư M'gar..."
                                value={formData.farmer_name || ''}
                                onChange={(e) => setFormData({ ...formData, farmer_name: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>

                        {/* Số điện thoại */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                                <Phone size={13} className="text-emerald-500" />
                                Số điện thoại liên hệ
                            </label>
                            <input
                                type="text"
                                placeholder="VD: 0912 345 678..."
                                value={formData.phone || ''}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Địa chỉ cụ thể */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <MapPin size={13} className="text-slate-400" />
                            Địa chỉ chi tiết / Huyện, Xã
                        </label>
                        <input
                            type="text"
                            placeholder="VD: Xã Quảng Phú, Huyện Cư M'gar, Đắk Lắk..."
                            value={formData.location || ''}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    {/* Ghi chú */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-400" />
                            Ghi chú bổ sung
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Mùa vụ thu hoạch, sản lượng dự kiến, giống cây trồng..."
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none"
                        />
                    </div>

                    {/* Trạng thái hoạt động */}
                    <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_active ?? true}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-zinc-300 dark:border-zinc-700"
                            />
                            <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                Đang hoạt động / Khai thác
                            </span>
                        </label>
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-sm font-bold transition-all cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                        <Save size={16} />
                        <span>{loading ? 'Đang lưu...' : initialData ? 'Cập nhật' : 'Khai báo Vùng Trồng'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
