'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ArrowLeft, Save, Loader2, Building2, User, Phone, Mail, MapPin, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'

type Supplier = Database['public']['Tables']['suppliers']['Row']

interface SupplierFormProps {
    initialData?: Supplier
    isEditMode?: boolean
}

export default function SupplierForm({ initialData, isEditMode = false }: SupplierFormProps) {
    const router = useRouter()
    const { systemType, currentSystem } = useSystem()
    const { profile } = useUser()
    const [loading, setLoading] = useState(false)
    const [generatingCode, setGeneratingCode] = useState(false)

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked
            setFormData(prev => ({ ...prev, [name]: checked }))
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    // Tự động tạo viết tắt từ tên phân hệ kho
    const getSystemAbbreviation = (systemCode: string, systemName?: string): string => {
        // Nếu có tên hệ thống, tạo viết tắt từ tên
        if (systemName) {
            // Bỏ chữ "Kho" nếu có ở đầu
            const nameWithoutKho = systemName.replace(/^Kho\s+/i, '')

            // Lấy chữ cái đầu của mỗi từ
            return nameWithoutKho
                .split(' ')
                .filter(word => word.length > 0)
                .map(word => word[0])
                .join('')
                .toUpperCase()
        }

        // Fallback: dùng 2-3 ký tự đầu của system code
        return systemCode.substring(0, 3).toUpperCase()
    }

    const generateSupplierCode = async () => {
        setGeneratingCode(true)
        try {
            // Lấy số lượng nhà cung cấp hiện có trong phân hệ kho này
            const { count, error } = await supabase
                .from('suppliers')
                .select('*', { count: 'exact', head: true })
                .eq('system_code', systemType)

            if (error) throw error

            const nextNumber = (count || 0) + 1
            const paddedNumber = nextNumber.toString().padStart(3, '0')
            const abbreviation = getSystemAbbreviation(systemType, currentSystem?.name)
            const newCode = `${abbreviation}-NCC${paddedNumber}`

            setFormData(prev => ({ ...prev, code: newCode }))
        } catch (error: any) {
            alert('Lỗi tạo mã: ' + error.message)
        } finally {
            setGeneratingCode(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isEditMode && initialData) {
                const { error } = await (supabase
                    .from('suppliers') as any)
                    .update(formData)
                    .eq('id', initialData.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('suppliers') as any)
                    .insert([{ ...formData, system_code: systemType, company_id: profile?.company_id || null }])
                if (error) throw error
            }

            router.push('/suppliers')
            router.refresh()
        } catch (error: any) {
            alert('Error saving supplier: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-3 rounded-xl outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"

    return (
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
            {/* ACTION BAR */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/suppliers"
                        className="p-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="text-orange-500" size={16} />
                            <span className="text-orange-600 text-xs font-medium">
                                {isEditMode ? 'Edit Supplier' : 'New Supplier'}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Nhà cung cấp' : 'Thêm Nhà cung cấp mới'}
                        </h1>
                        <p className="text-stone-500 text-sm">Quản lý thông tin nhà cung cấp phụ tùng</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/suppliers"
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
                        {isEditMode ? 'Lưu thay đổi' : 'Tạo nhà cung cấp'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN - Main Info */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Basic Info Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Building2 size={20} className="text-orange-500" />
                            Thông tin cơ bản
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Mã nhà cung cấp <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        name="code"
                                        required
                                        value={formData.code}
                                        onChange={handleChange}
                                        className={`${inputClass} font-mono uppercase flex-1`}
                                        placeholder="VD: DL-NCC001"
                                    />
                                    {!isEditMode && (
                                        <button
                                            type="button"
                                            onClick={generateSupplierCode}
                                            disabled={generatingCode}
                                            className="px-3 py-2 rounded-lg text-sm font-medium text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100 transition-colors disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                                            title="Tự động tạo mã"
                                        >
                                            {generatingCode ? (
                                                <Loader2 className="animate-spin" size={16} />
                                            ) : (
                                                <Sparkles size={16} />
                                            )}
                                            Tạo mã
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    Tên nhà cung cấp <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="VD: Công ty TNHH ABC"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    <User size={14} className="inline mr-1" />
                                    Người liên hệ
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
                                <label className="block text-sm font-medium text-stone-700 mb-2">Mã số thuế</label>
                                <input
                                    name="tax_code"
                                    value={formData.tax_code}
                                    onChange={handleChange}
                                    className={`${inputClass} font-mono`}
                                    placeholder="VD: 0123456789"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <Phone size={20} className="text-orange-500" />
                            Thông tin liên hệ
                        </h2>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    <Phone size={14} className="inline mr-1" />
                                    Số điện thoại
                                </label>
                                <input
                                    name="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="VD: 0912345678"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-2">
                                    <Mail size={14} className="inline mr-1" />
                                    Email
                                </label>
                                <input
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder="VD: contact@abc.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-700 mb-2">
                                <MapPin size={14} className="inline mr-1" />
                                Địa chỉ
                            </label>
                            <textarea
                                name="address"
                                rows={2}
                                value={formData.address}
                                onChange={handleChange}
                                className={`${inputClass} resize-none`}
                                placeholder="VD: 123 Đường ABC, Quận XYZ, TP.HCM"
                            />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200">
                            Trạng thái
                        </h2>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                name="is_active"
                                checked={formData.is_active}
                                onChange={handleChange}
                                className="w-5 h-5 rounded border-stone-300 text-orange-500 focus:ring-orange-400"
                            />
                            <span className="text-stone-700">Đang hoạt động</span>
                        </label>
                    </div>

                    {/* Notes Card */}
                    <div className="bg-white rounded-2xl p-6 space-y-5 border border-stone-200">
                        <h2 className="font-semibold text-lg text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2">
                            <FileText size={20} className="text-orange-500" />
                            Ghi chú
                        </h2>

                        <textarea
                            name="notes"
                            rows={5}
                            value={formData.notes}
                            onChange={handleChange}
                            className={`${inputClass} resize-none`}
                            placeholder="Ghi chú thêm về nhà cung cấp..."
                        />
                    </div>
                </div>
            </div>
        </form>
    )
}
