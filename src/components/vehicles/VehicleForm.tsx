'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ArrowLeft, Save, Loader2, Car, Calendar, Sparkles } from 'lucide-react'
import Link from 'next/link'

type Vehicle = Database['public']['Tables']['vehicles']['Row']

interface VehicleFormProps {
    initialData?: Vehicle
    isEditMode?: boolean
}

const BRANDS = [
    'Toyota', 'Honda', 'Mazda', 'Ford', 'Hyundai', 'Kia', 'Mitsubishi', 'Suzuki',
    'VinFast', 'Mercedes-Benz', 'BMW', 'Audi', 'Isuzu', 'Chevrolet', 'Nissan',
    'Lexus', 'Peugeot', 'MG', 'Subaru', 'Volvo', 'Khác'
]

const BODY_TYPES = [
    { value: 'Sedan', label: 'Sedan' },
    { value: 'SUV', label: 'SUV' },
    { value: 'Hatchback', label: 'Hatchback' },
    { value: 'MPV', label: 'MPV (Đa dụng)' },
    { value: 'Pickup', label: 'Bán tải (Pickup)' },
    { value: 'Van', label: 'Van' },
    { value: 'Truck', label: 'Xe tải' },
    { value: 'Coupe', label: 'Coupe' },
    { value: 'Convertible', label: 'Mui trần' },
]

export default function VehicleForm({ initialData, isEditMode = false }: VehicleFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const currentYear = new Date().getFullYear()
    const years = Array.from({ length: 30 }, (_, i) => currentYear - i)

    const [formData, setFormData] = useState({
        brand: initialData?.brand || '',
        model: initialData?.model || '',
        year_from: initialData?.year_from?.toString() || '',
        year_to: initialData?.year_to?.toString() || '',
        engine_type: initialData?.engine_type || '',
        body_type: initialData?.body_type || '',
        notes: initialData?.notes || '',
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const payload = {
            ...formData,
            year_from: formData.year_from ? parseInt(formData.year_from) : null,
            year_to: formData.year_to ? parseInt(formData.year_to) : null,
        }

        try {
            if (isEditMode && initialData) {
                const { error } = await (supabase
                    .from('vehicles') as any)
                    .update(payload)
                    .eq('id', initialData.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('vehicles') as any)
                    .insert([payload])
                if (error) throw error
            }

            router.push('/vehicles')
            router.refresh()
        } catch (error: any) {
            alert('Error saving vehicle: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-3 rounded-xl outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
            {/* ACTION BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/vehicles"
                        className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="text-orange-500" size={16} />
                            <span className="text-orange-600 text-xs font-medium">
                                {isEditMode ? 'Edit Vehicle' : 'New Vehicle'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Dòng xe' : 'Thêm Dòng xe mới'}
                        </h1>
                        <p className="text-stone-500 text-sm">Thông tin dòng xe để tra cứu phụ tùng tương thích</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/vehicles"
                        className="px-5 py-2.5 rounded-xl font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 hover:text-stone-800 transition-colors"
                    >
                        Hủy bỏ
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-white transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 4px 15px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        {isEditMode ? 'Lưu thay đổi' : 'Tạo dòng xe'}
                    </button>
                </div>
            </div>

            {/* FORM CONTENT */}
            <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                    <Car size={20} className="text-orange-500" />
                    Thông tin xe
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            Hãng xe <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="brand"
                            required
                            value={formData.brand}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">-- Chọn hãng xe --</option>
                            {BRANDS.map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            Dòng xe <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="model"
                            required
                            value={formData.model}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: Camry, Ranger, CR-V..."
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            <Calendar size={14} className="inline mr-1" />
                            Từ năm
                        </label>
                        <select
                            name="year_from"
                            value={formData.year_from}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">-- Năm --</option>
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">
                            <Calendar size={14} className="inline mr-1" />
                            Đến năm
                        </label>
                        <select
                            name="year_to"
                            value={formData.year_to}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">Hiện tại</option>
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Kiểu thân xe</label>
                        <select
                            name="body_type"
                            value={formData.body_type}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="">-- Chọn --</option>
                            {BODY_TYPES.map(bt => (
                                <option key={bt.value} value={bt.value}>{bt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Loại động cơ</label>
                    <input
                        name="engine_type"
                        value={formData.engine_type}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="VD: 1.5L, 2.0L Turbo, 2.4L Diesel..."
                    />
                    <p className="text-xs text-stone-400 mt-1.5">Để trống nếu áp dụng cho tất cả động cơ</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Ghi chú</label>
                    <textarea
                        name="notes"
                        rows={3}
                        value={formData.notes}
                        onChange={handleChange}
                        className={`${inputClass} resize-none`}
                        placeholder="Ghi chú thêm..."
                    />
                </div>
            </div>
        </form>
    )
}
