'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { logActivity } from '@/lib/audit'
import { useUser } from '@/contexts/UserContext'
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
    username: string | null
    full_name: string
    phone: string | null
    email: string | null
    role_id: string | null
    department: string | null
    is_active: boolean
    allowed_systems: string[] | null
}

interface UserFormProps {
    initialData?: UserProfile
    isEditMode?: boolean
}

export default function SanxuatUserForm({ initialData, isEditMode = false }: UserFormProps) {
    const router = useRouter()
    const { profile: loggedInProfile } = useUser()
    const [loading, setLoading] = useState(false)
    const [roles, setRoles] = useState<Role[]>([])

    const isSystemAdmin = isEditMode && !initialData?.employee_code
    const [newPassword, setNewPassword] = useState('')
    const [resettingPass, setResettingPass] = useState(false)
    const [companyPrefix, setCompanyPrefix] = useState('')

    const [formData, setFormData] = useState({
        employee_code: initialData?.employee_code || '',
        username: initialData?.username || '',
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        role_id: initialData?.role_id || '',
        department: initialData?.department || 'Sản Xuất',
        is_active: initialData?.is_active ?? true,
        allowed_systems: initialData?.allowed_systems || ['SANXUAT'],
        password: '',
    })

    const generatePrefix = (str: string) => {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
    }

    useEffect(() => {
        fetchRoles()
        if (!isEditMode) {
            fetchCompanyPrefix()
        }
    }, [isEditMode])

    useEffect(() => {
        if (!isEditMode && companyPrefix) {
            fetchLatestEmployeeCode(companyPrefix)
        }
    }, [isEditMode, companyPrefix])

    async function fetchCompanyPrefix() {
        if (loggedInProfile?.company_id) {
            const { data } = await supabase.from('company_settings' as any)
                .select('code, short_name, name')
                .eq('id', loggedInProfile.company_id)
                .single()

            if (data) {
                const company = data as any
                if (company.code) {
                    setCompanyPrefix(company.code.toLowerCase())
                } else {
                    const source = company.short_name || company.name
                    if (source) {
                        setCompanyPrefix(generatePrefix(source))
                    }
                }
            }
        }
    }

    async function fetchLatestEmployeeCode(prefixStr: string) {
        try {
            const codePrefix = prefixStr.toUpperCase()
            const { data } = await supabase
                .from('user_profiles')
                .select('employee_code')
                .ilike('employee_code', `${codePrefix}-SX%`)
                .order('employee_code', { ascending: false })
                .limit(1)
                .maybeSingle()

            let nextCode = `${codePrefix}-SX001`
            if (data && data.employee_code) {
                const currentCode = data.employee_code
                const numberPart = parseInt(currentCode.replace(/\D/g, ''), 10)
                if (!isNaN(numberPart)) {
                    nextCode = `${codePrefix}-SX${String(numberPart + 1).padStart(3, '0')}`
                }
            }
            setFormData(prev => ({ ...prev, employee_code: nextCode }))
        } catch (error) {
            console.error('Error fetching employee code:', error)
        }
    }

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

    async function handleResetPassword() {
        if (!newPassword || newPassword.length < 6) {
            alert('Mật khẩu mới phải có ít nhất 6 ký tự')
            return
        }
        if (!initialData?.id) return
        if (!confirm('Bạn có chắc chắn muốn đổi mật khẩu cho tài khoản này?')) return

        try {
            setResettingPass(true)
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: initialData.id,
                    password: newPassword
                })
            })
            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            alert('Đổi mật khẩu thành công!')
            setNewPassword('')
        } catch (error: any) {
            alert('Lỗi: ' + error.message)
        } finally {
            setResettingPass(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isEditMode && initialData) {
                const updatePayload = {
                    employee_code: formData.employee_code || null,
                    username: formData.username || null,
                    full_name: formData.full_name,
                    phone: formData.phone || null,
                    email: formData.email || null,
                    role_id: formData.role_id || null,
                    department: formData.department || null,
                    is_active: formData.is_active,
                    // keep existing or hardcode SANXUAT for sanity
                    allowed_systems: formData.allowed_systems?.includes('SANXUAT') ? formData.allowed_systems : [...(formData.allowed_systems || []), 'SANXUAT'],
                }

                const { error } = await supabase
                    .from('user_profiles')
                    .update(updatePayload)
                    .eq('id', initialData.id)

                if (error) throw error

                await logActivity({
                    supabase,
                    tableName: 'user_profiles',
                    recordId: initialData.id,
                    action: 'UPDATE',
                    oldData: initialData,
                    newData: updatePayload
                })

            } else {
                let submitEmail = formData.email
                let finalUsername = formData.username

                if (!submitEmail && formData.username) {
                    let prefix = 'uu'
                    if (loggedInProfile?.company_id) {
                        const { data } = await supabase
                            .from('company_settings' as any)
                            .select('code, short_name, name')
                            .eq('id', loggedInProfile.company_id)
                            .single()

                        if (data) {
                            const company = data as any
                            if (company.code) {
                                prefix = company.code.toLowerCase()
                            } else {
                                const source = company.short_name || company.name
                                if (source) {
                                    prefix = generatePrefix(source)
                                }
                            }
                        }
                    }
                    finalUsername = `${prefix}.${formData.username}`
                    submitEmail = `${finalUsername}@system.local`
                }

                if (!submitEmail || !formData.password) {
                    throw new Error('Tài khoản (hoặc Email) và mật khẩu là bắt buộc')
                }

                const response = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: submitEmail,
                        password: formData.password,
                        username: finalUsername,
                        full_name: formData.full_name,
                        employee_code: formData.employee_code,
                        phone: formData.phone,
                        role_id: formData.role_id,
                        department: formData.department,
                        is_active: formData.is_active,
                        allowed_systems: ['SANXUAT'],
                        company_id: loggedInProfile?.company_id
                    })
                })

                const result = await response.json()

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to create user')
                }

                if (result.user) {
                    await logActivity({
                        supabase,
                        tableName: 'user_profiles',
                        recordId: result.user.id,
                        action: 'CREATE',
                        newData: {
                            username: finalUsername,
                            email: submitEmail,
                            company_id: loggedInProfile?.company_id
                        }
                    })
                }
            }

            router.push('/sanxuat/users')
            router.refresh()
        } catch (error: any) {
            alert('Lỗi: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full p-2.5 rounded-lg outline-none transition-all duration-200 bg-stone-50 border border-stone-200 text-stone-800 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-stone-100"

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/sanxuat/users" className="p-2 rounded-lg bg-stone-100 border border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600 transition-colors">
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-stone-800">
                            {isEditMode ? 'Cập nhật Người dùng Sản Xuất' : 'Thêm Người dùng Sản Xuất'}
                        </h1>
                        <p className="text-stone-500 text-xs">
                            Thông tin tài khoản cho hệ thống sản xuất
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                    <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                        <Shield size={16} className="text-emerald-500" />
                        {isSystemAdmin ? 'Đổi mật khẩu' : 'Thông tin đăng nhập'}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        {!isSystemAdmin && (
                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                    Tên tài khoản (Username) <span className="text-red-500">*</span>
                                </label>
                                <div className="flex rounded-lg shadow-sm ring-1 ring-inset ring-stone-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-emerald-500 bg-white overflow-hidden">
                                    {companyPrefix && (
                                        <span className="flex select-none items-center pl-3 pr-2 text-stone-500 text-sm bg-stone-50 border-r border-stone-100">
                                            {companyPrefix}.
                                        </span>
                                    )}
                                    <input
                                        name="username"
                                        required
                                        value={formData.username}
                                        onChange={handleChange}
                                        className="block flex-1 border-0 bg-transparent py-2.5 pl-2 text-stone-900 placeholder:text-stone-400 focus:ring-0 sm:text-sm sm:leading-6 outline-none"
                                        placeholder="user01"
                                    />
                                </div>
                            </div>
                        )}

                        {!isSystemAdmin ? (
                            <div>
                                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                    Mật khẩu {isEditMode ? '' : <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required={!isEditMode}
                                    value={formData.password}
                                    onChange={handleChange}
                                    className={inputClass}
                                    placeholder={isEditMode ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự"}
                                    minLength={6}
                                />
                            </div>
                        ) : (
                            <div className="col-span-2 flex items-end gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                        Mật khẩu mới
                                    </label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className={inputClass}
                                        placeholder="Nhập mật khẩu mới..."
                                    />
                                </div>
                                <button
                                    type="button"
                                    disabled={resettingPass || !newPassword}
                                    onClick={handleResetPassword}
                                    className="px-4 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-medium hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {resettingPass ? <Loader2 className="animate-spin" size={16} /> : 'Cập nhật Mật khẩu'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                    <h2 className="font-semibold text-stone-800 pb-3 border-b border-stone-200 flex items-center gap-2 text-sm">
                        <User size={16} className="text-emerald-500" />
                        Thông tin cá nhân
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1.5">
                                Họ và tên {isSystemAdmin ? '' : <span className="text-red-500">*</span>}
                            </label>
                            <input
                                name="full_name"
                                required={!isSystemAdmin}
                                value={formData.full_name}
                                onChange={handleChange}
                                disabled={isSystemAdmin}
                                className={inputClass}
                                placeholder="VD: Nguyễn Văn A"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1.5">Mã nhân viên</label>
                            <input
                                name="employee_code"
                                value={isSystemAdmin ? 'QUẢN TRỊ VIÊN' : formData.employee_code}
                                onChange={handleChange}
                                disabled={isSystemAdmin}
                                className={`${inputClass} font-mono`}
                                placeholder="VD: SX001"
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
                                disabled={isSystemAdmin}
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
                                    disabled={isSystemAdmin}
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
                            value={isSystemAdmin ? 'Hệ thống' : formData.department}
                            onChange={handleChange}
                            disabled={isSystemAdmin}
                            className={inputClass}
                            placeholder="VD: Sản xuất 1..."
                        />
                    </div>
                </div>

                {!isSystemAdmin && (
                    <div className="bg-white rounded-xl p-5 space-y-4 border border-stone-200">
                        <div className="pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="is_active"
                                    checked={formData.is_active}
                                    onChange={handleChange}
                                    className="w-4 h-4 rounded border-stone-300 text-emerald-500 focus:ring-emerald-400"
                                />
                                <span className="text-sm text-stone-700">Tài khoản hoạt động</span>
                            </label>
                        </div>
                    </div>
                )}

                {!isSystemAdmin && (
                    <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                        <Link
                            href="/sanxuat/users"
                            className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:border-stone-300 transition-colors"
                        >
                            Hủy
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 disabled:opacity-50"
                            style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                            }}
                        >
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            {isEditMode ? 'Lưu thay đổi' : 'Tạo mới'}
                        </button>
                    </div>
                )}
            </form>
        </div>
    )
}
