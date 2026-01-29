'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { logActivity } from '@/lib/audit'
import { useUser } from '@/contexts/UserContext'
import { ArrowLeft, Save, Loader2, User, Phone, Mail, Shield, Building, Warehouse } from 'lucide-react'
import Link from 'next/link'

interface Role {
    id: string
    code: string
    name: string
}

interface System {
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

export default function UserForm({ initialData, isEditMode = false }: UserFormProps) {
    const router = useRouter()
    const { profile: loggedInProfile } = useUser()
    const [loading, setLoading] = useState(false)
    const [roles, setRoles] = useState<Role[]>([])
    const [systems, setSystems] = useState<System[]>([])
    const [companyPrefix, setCompanyPrefix] = useState('')

    const [formData, setFormData] = useState({
        employee_code: initialData?.employee_code || '',
        username: initialData?.username || '',
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        email: initialData?.email || '',
        role_id: initialData?.role_id || '',
        department: initialData?.department || '',
        is_active: initialData?.is_active ?? true,
        allowed_systems: initialData?.allowed_systems || ['FROZEN'],
        // For new user
        password: '',
    })

    useEffect(() => {
        fetchRoles()
        fetchSystems()
        if (!isEditMode) {
            fetchLatestEmployeeCode()
            fetchCompanyPrefix()
        }
    }, [isEditMode])

    async function fetchCompanyPrefix() {
        if (loggedInProfile?.company_id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data } = await supabase.from('companies' as any)
                .select('username_prefix, code')
                .eq('id', loggedInProfile.company_id)
                .maybeSingle()

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const company = data as any
            if (company?.username_prefix) {
                setCompanyPrefix(company.username_prefix)
            } else if (company?.code) {
                setCompanyPrefix(company.code.substring(0, 3))
            }
        }
    }

    async function fetchSystems() {
        // systems might not be in the default Types yet if generated via introspection only on public schema
        // and systems table was added later or is in a different state.
        // But we should try to use the typed client.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await supabase.from('systems' as any).select('code, name').order('created_at')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (data) setSystems(data as any)
    }

    async function fetchLatestEmployeeCode() {
        try {
            const { data } = await supabase
                .from('user_profiles')
                .select('employee_code')
                .ilike('employee_code', 'NV%')
                .order('employee_code', { ascending: false })
                .limit(1)
                .maybeSingle()

            let nextCode = 'NV001'
            if (data && data.employee_code) {
                const currentCode = data.employee_code
                const numberPart = parseInt(currentCode.replace(/\D/g, ''), 10)
                if (!isNaN(numberPart)) {
                    nextCode = `NV${String(numberPart + 1).padStart(3, '0')}`
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

    const handleSystemChange = (sysId: string) => {
        setFormData(prev => {
            const current = prev.allowed_systems || []
            if (current.includes(sysId)) {
                return { ...prev, allowed_systems: current.filter(s => s !== sysId) }
            } else {
                return { ...prev, allowed_systems: [...current, sysId] }
            }
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isEditMode && initialData) {
                // Update existing user profile
                const updatePayload = {
                    employee_code: formData.employee_code || null,
                    username: formData.username || null,
                    full_name: formData.full_name,
                    phone: formData.phone || null,
                    email: formData.email || null,
                    role_id: formData.role_id || null,
                    department: formData.department || null,
                    is_active: formData.is_active,
                    allowed_systems: formData.allowed_systems,
                }

                const { error } = await supabase
                    .from('user_profiles')
                    .update(updatePayload)
                    .eq('id', initialData.id)

                if (error) throw error

                // Log Activity
                await logActivity({
                    supabase,
                    tableName: 'user_profiles',
                    recordId: initialData.id,
                    action: 'UPDATE',
                    oldData: initialData,
                    newData: updatePayload
                })

            } else {
                // Create new user with Supabase Auth
                let submitEmail = formData.email
                let finalUsername = formData.username

                // Logic for Company Prefix
                if (!submitEmail && formData.username) {
                    let prefix = 'uu' // default if unknown
                    if (loggedInProfile?.company_id) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { data: company } = await supabase
                            .from('companies' as any)
                            .select('code, username_prefix')
                            .eq('id', loggedInProfile.company_id)
                            .maybeSingle()

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const companyData = company as any
                        if (companyData?.username_prefix) {
                            prefix = companyData.username_prefix.toLowerCase()
                        } else if (companyData?.code) {
                            // Fallback if prefix not set
                            prefix = companyData.code.toLowerCase().substring(0, 3)
                        }
                    }

                    // Enforce prefix on username
                    finalUsername = `${prefix}.${formData.username}`
                    // Standardized system email
                    submitEmail = `${finalUsername}@system.local`
                }

                if (!submitEmail || !formData.password) {
                    throw new Error('Tài khoản (hoặc Email) và mật khẩu là bắt buộc')
                }

                // 1. Create user via Server API (prevents auto-login)
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
                        allowed_systems: formData.allowed_systems,
                        company_id: loggedInProfile?.company_id
                    })
                })

                const result = await response.json()

                if (!response.ok) {
                    throw new Error(result.error || 'Failed to create user')
                }

                // Log Activity (Client side log is fine, or move to server)
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

            router.push('/users')
            router.refresh()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                                Tên tài khoản (Username) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                {companyPrefix && (
                                    <div className="absolute left-0 top-0 bottom-0 px-3 bg-stone-100 border-r border-stone-200 rounded-l-lg flex items-center text-stone-500 text-sm font-medium">
                                        {companyPrefix}.
                                    </div>
                                )}
                                <input
                                    name="username"
                                    required
                                    value={formData.username}
                                    onChange={handleChange}
                                    className={`${inputClass} ${companyPrefix ? 'pl-16' : ''}`}
                                    placeholder="VD: user01"
                                />
                            </div>
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
                    Phân quyền & Phạm vi
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1.5">Vai trò hệ thống</label>
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
                        <p className="text-[10px] text-stone-400 mt-1">
                            Quyết định các chức năng được phép sử dụng (Xem, Sửa, Xóa...)
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-stone-700 mb-2 flex items-center gap-2">
                            <Warehouse size={14} />
                            Phạm vi hoạt động (Kho)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {systems.map((sys) => (
                                <label key={sys.code} className={`
                                    flex items-center gap-2 cursor-pointer p-2 rounded border transition-colors select-none
                                    ${(formData.allowed_systems || []).includes(sys.code)
                                        ? 'bg-orange-50 border-orange-200 text-orange-800'
                                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                    }
                                `}>
                                    <input
                                        type="checkbox"
                                        checked={(formData.allowed_systems || []).includes('ALL') || (formData.allowed_systems || []).includes(sys.code)}
                                        onChange={() => handleSystemChange(sys.code)}
                                        disabled={(formData.allowed_systems || []).includes('ALL')} // Disable individual check if ALL is set
                                        className="w-4 h-4 rounded text-orange-500 focus:ring-orange-400 border-stone-300 accent-orange-500"
                                    />
                                    <span className="text-sm font-medium">{sys.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t border-stone-100">
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
