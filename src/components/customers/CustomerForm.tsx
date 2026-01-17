'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, Save, Loader2, User, Phone, Mail, MapPin, FileText } from 'lucide-react'
import Link from 'next/link'

interface Customer {
    id: string
    code: string
    name: string
    contact_person: string | null
    phone: string | null
    email: string | null
    address: string | null
    tax_code: string | null
    notes: string | null
    is_active: boolean
    created_at: string
}

interface CustomerFormProps {
    initialData?: Customer
    isEditMode?: boolean
}

export default function CustomerForm({ initialData, isEditMode = false }: CustomerFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const [formData, setFormData] = useState({
        code: initialData?.code || '',
        name: initialData?.name || '',
        contact_person: initialData?.contact_person || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        address: initialData?.address || '',
        tax_code: initialData?.tax_code || '',
        notes: initialData?.notes || '',
        is_active: initialData?.is_active ?? true,
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked
            setFormData(prev => ({ ...prev, [name]: checked }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        const payload = {
            ...formData,
            contact_person: formData.contact_person || null,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            tax_code: formData.tax_code || null,
            notes: formData.notes || null,
        }

        try {
            if (isEditMode && initialData) {
                const { error } = await (supabase
                    .from('customers') as any)
                    .update(payload)
                    .eq('id', initialData.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('customers') as any)
                    .insert([payload])
                if (error) throw error
            }

            router.push('/customers')
            router.refresh()
        } catch (error: any) {
            alert('Lỗi: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-2.5 rounded-lg outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 text-sm placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

    return (
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/customers"
                        className="p-2 rounded-lg bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Khách hàng' : 'Thêm Khách hàng'}
                        </h1>
                        <p className="text-stone-500 text-xs">Thông tin chi tiết về khách hàng</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/customers"
                        className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 transition-colors"
                    >
                        Hủy
                    </Link>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-50"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        {isEditMode ? 'Lưu' : 'Tạo mới'}
                    </button>
                </div>
            </div>

            {/* FORM CONTENT */}
            <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                    <User size={16} className="text-orange-500" />
                    Thông tin cơ bản
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            Mã khách hàng <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="code"
                            required
                            value={formData.code}
                            onChange={handleChange}
                            className={`${inputClass} font-mono`}
                            placeholder="VD: KH001"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            Tên khách hàng <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: Garage ABC"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            <span className="flex items-center gap-1"><User size={12} /> Người liên hệ</span>
                        </label>
                        <input
                            name="contact_person"
                            value={formData.contact_person}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            <span className="flex items-center gap-1"><Phone size={12} /> Số điện thoại</span>
                        </label>
                        <input
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: 0901234567"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            <span className="flex items-center gap-1"><Mail size={12} /> Email</span>
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: contact@abc.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            <span className="flex items-center gap-1"><FileText size={12} /> Mã số thuế</span>
                        </label>
                        <input
                            name="tax_code"
                            value={formData.tax_code}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: 0123456789"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        <span className="flex items-center gap-1"><MapPin size={12} /> Địa chỉ</span>
                    </label>
                    <input
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="VD: 123 Nguyễn Văn Linh, Q7, TP.HCM"
                    />
                </div>

                <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">Ghi chú</label>
                    <textarea
                        name="notes"
                        rows={2}
                        value={formData.notes}
                        onChange={handleChange}
                        className={`${inputClass} resize-none`}
                        placeholder="Ghi chú thêm..."
                    />
                </div>

                <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleChange}
                            className="w-4 h-4 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                        />
                        <span className="text-sm text-stone-700">Đang hoạt động</span>
                    </label>
                </div>
            </div>
        </form>
    )
}
