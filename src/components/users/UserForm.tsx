'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ArrowLeft, Save, Loader2, User, Phone, Mail, Shield, Building } from 'lucide-react'
import Link from 'next/link'

interface Role {
    id: string
    code: string
    name: string
}

interface UserProfile {
    id: string
    employee_code: string | null
    full_name: string
    phone: string | null
    email: string | null
    role_id: string | null
    department: string | null
    is_active: boolean
}

interface UserFormProps {
    initialData?: UserProfile
    isEditMode?: boolean
}

export default function UserForm({ initialData, isEditMode = false }: UserFormProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [roles, setRoles] = useState<Role[]>([])

    const [formData, setFormData] = useState({
        employee_code: initialData?.employee_code || '',
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        role_id: initialData?.role_id || '',
        department: initialData?.department || '',
        is_active: initialData?.is_active ?? true,
        // For new user
        password: '',
    })

    useEffect(() => {
        fetchRoles()
    }, [])

    async function fetchRoles() {
        const { data } = await supabase.from('roles').select('*').order('name')
        if (data) setRoles(data)
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

        try {
            if (isEditMode && initialData) {
                // Update existing user profile
                const { error } = await (supabase
                    .from('user_profiles') as any)
                    .update({
                        employee_code: formData.employee_code || null,
                        full_name: formData.full_name,
                        phone: formData.phone || null,
                        email: formData.email || null,
                        role_id: formData.role_id || null,
                        department: formData.department || null,
                        is_active: formData.is_active,
                    })
                    .eq('id', initialData.id)

                if (error) throw error
            } else {
                // Create new user with Supabase Auth
                if (!formData.email || !formData.password) {
                    throw new Error('Email và mật khẩu là bắt buộc')
                }

                // 1. Create auth user
                const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                    email: formData.email,
                    password: formData.password,
                    email_confirm: true,
                })

                if (authError) {
                    // Fallback: use signUp if admin API not available
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: formData.email,
                        password: formData.password,
                    })

                    if (signUpError) throw signUpError

                    if (signUpData.user) {
                        // 2. Create user profile
                        const { error: profileError } = await (supabase
                            .from('user_profiles') as any)
                            .insert([{
                                id: signUpData.user.id,
                                employee_code: formData.employee_code || null,
                                full_name: formData.full_name,
                                phone: formData.phone || null,
                                email: formData.email,
                                role_id: formData.role_id || null,
                                department: formData.department || null,
                                is_active: formData.is_active,
                            }])

                        if (profileError) throw profileError
                    }
                } else if (authData.user) {
                    // 2. Create user profile
                    const { error: profileError } = await (supabase
                        .from('user_profiles') as any)
                        .insert([{
                            id: authData.user.id,
                            employee_code: formData.employee_code || null,
                            full_name: formData.full_name,
                            phone: formData.phone || null,
                            email: formData.email,
                            role_id: formData.role_id || null,
                            department: formData.department || null,
                            is_active: formData.is_active,
                        }])

                    if (profileError) throw profileError
                }
            }

            router.push('/users')
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
                        href="/users"
                        className="p-2 rounded-lg bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Người dùng' : 'Thêm Người dùng'}
                        </h1>
                        <p className="text-stone-500 text-xs">Thông tin tài khoản và phân quyền</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/users"
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

            {/* ACCOUNT INFO - Only for new users */}
            {!isEditMode && (
                <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                    <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                        <Shield size={16} className="text-orange-500" />
                        Thông tin đăng nhập
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                Email đăng nhập <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="VD: user@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                Mật khẩu <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                className={inputClass}
                                placeholder="Tối thiểu 6 ký tự"
                                minLength={6}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* PROFILE INFO */}
            <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                    <User size={16} className="text-orange-500" />
                    Thông tin cá nhân
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">
                            Họ và tên <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="full_name"
                            required
                            value={formData.full_name}
                            onChange={handleChange}
                            className={inputClass}
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">Mã nhân viên</label>
                        <input
                            name="employee_code"
                            value={formData.employee_code}
                            onChange={handleChange}
                            className={`${inputClass} font-mono`}
                            placeholder="VD: NV001"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    {isEditMode && (
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
                                placeholder="VD: user@company.com"
                            />
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                        <span className="flex items-center gap-1"><Building size={12} /> Phòng ban</span>
                    </label>
                    <input
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="VD: Kho vận, Kinh doanh, Kế toán..."
                    />
                </div>
            </div>

            {/* ROLE & STATUS */}
            <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                    <Shield size={16} className="text-orange-500" />
                    Phân quyền
                </h2>

                <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1.5">Vai trò</label>
                    <select
                        name="role_id"
                        value={formData.role_id}
                        onChange={handleChange}
                        className={inputClass}
                    >
                        <option value="">-- Chọn vai trò --</option>
                        {roles.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                    </select>
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
                        <span className="text-sm text-stone-700">Tài khoản hoạt động</span>
                    </label>
                </div>
            </div>
        </form>
    )
}
