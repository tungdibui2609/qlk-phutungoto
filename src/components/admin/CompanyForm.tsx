import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, X, User, Shield, Lock, Mail, Building, Edit, Check, Plus } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'

interface CompanyFormProps {
    initialData?: any
    onClose: () => void
    onSuccess: () => void
}

export default function CompanyForm({ initialData, onClose, onSuccess }: CompanyFormProps) {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [admins, setAdmins] = useState<any[]>([])
    const [loadingAdmins, setLoadingAdmins] = useState(false)
    const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
    const [isAddingAdmin, setIsAddingAdmin] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        tax_code: '',
        // Admin User Data (Create Mode)
        admin_name: '',
        admin_email: '',
        admin_password: '',
        // Admin User Data (Edit Mode - Update)
        edit_admin_name: '',
        edit_admin_email: '',
        edit_admin_password: '',
        // Admin User Data (Edit Mode - ADD NEW)
        new_admin_name: '',
        new_admin_email: '',
        new_admin_password: ''
    })

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                name: initialData.name || '',
                code: initialData.code || '',
                address: initialData.address || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                tax_code: initialData.tax_code || ''
            }))
            fetchAdmins(initialData.id)
        }
    }, [initialData])

    const fetchAdmins = async (companyId: string) => {
        setLoadingAdmins(true)
        // Bypass RLS allows fetching users
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('company_id', companyId)
        // Filter locally or via query if possible. array columns filter is tricky in some versions
        // We'll filter client side for permissions

        if (data) {
            const adminUsers = data.filter((u: any) => {
                // Check if user has full access permission
                if (Array.isArray(u.permissions) && u.permissions.includes('system.full_access')) return true;
                // Fallback for string format (rare but possible in some pg clients)
                if (typeof u.permissions === 'string' && u.permissions.includes('system.full_access')) return true;
                return false;
            })
            setAdmins(adminUsers)
            // Auto-select first admin if only one
            if (adminUsers.length === 1) {
                selectAdminForEdit(adminUsers[0])
            }
        }
        setLoadingAdmins(false)
    }

    const selectAdminForEdit = (user: any) => {
        setSelectedAdmin(user)
        setIsAddingAdmin(false)
        setFormData(prev => ({
            ...prev,
            edit_admin_name: user.full_name || '',
            edit_admin_email: user.email || '',
            edit_admin_password: '' // Reset password field
        }))
    }

    const generateCode = (name: string) => {
        return name.toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d").replace(/Đ/g, "D")
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => {
            const updates = { ...prev, [name]: value }
            if (name === 'name' && !initialData) {
                updates.code = generateCode(value)
            }
            return updates
        })
    }

    const handleAddAdmin = async () => {
        if (!formData.new_admin_name || !formData.new_admin_email || !formData.new_admin_password) {
            return showToast('Vui lòng nhập đầy đủ thông tin Admin mới', 'error')
        }
        if (formData.new_admin_password.length < 6) {
            return showToast('Mật khẩu phải từ 6 ký tự trở lên', 'error')
        }

        setLoading(true)
        try {
            const response = await fetch('/api/admin/create-admin-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyId: initialData.id,
                    email: formData.new_admin_email,
                    password: formData.new_admin_password,
                    full_name: formData.new_admin_name
                })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)

            showToast('Thêm Admin thành công', 'success')
            setIsAddingAdmin(false)
            // Clear inputs
            setFormData(prev => ({ ...prev, new_admin_name: '', new_admin_email: '', new_admin_password: '' }))
            fetchAdmins(initialData.id) // Refresh list
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateAdmin = async () => {
        if (!selectedAdmin) return
        if (!formData.edit_admin_email) return showToast('Email không được để trống', 'error')

        setLoading(true)
        try {
            const response = await fetch('/api/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedAdmin.id,
                    email: formData.edit_admin_email,
                    full_name: formData.edit_admin_name,
                    password: formData.edit_admin_password || undefined
                })
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)

            showToast('Cập nhật thông tin Admin thành công', 'success')
            fetchAdmins(initialData.id) // Refresh list
            // Don't close modal, just refresh admin part?
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name || !formData.code) return showToast('Vui lòng nhập tên và mã công ty', 'error')

        // Validate New Admin info
        if (!initialData) {
            if (!formData.admin_name || !formData.admin_email || !formData.admin_password) {
                return showToast('Vui lòng nhập đầy đủ thông tin Quản trị viên', 'error')
            }
            if (formData.admin_password.length < 6) {
                return showToast('Mật khẩu quản trị viên phải từ 6 ký tự trở lên', 'error')
            }
        }

        setLoading(true)
        try {
            if (initialData) {
                // UPDATE COMPANY ONLY (Admin update is separate)
                const { error } = await (supabase as any).from('companies').update({
                    name: formData.name,
                    code: formData.code,
                    address: formData.address,
                    phone: formData.phone,
                    email: formData.email,
                    tax_code: formData.tax_code
                }).eq('id', initialData.id)
                if (error) throw error
                showToast('Cập nhật thông tin công ty thành công', 'success')
            } else {
                // CREATE NEW COMPANY & ADMIN
                const response = await fetch('/api/admin/create-company', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.name,
                        code: formData.code,
                        address: formData.address,
                        phone: formData.phone,
                        email: formData.email,
                        tax_code: formData.tax_code,
                        admin_name: formData.admin_name,
                        admin_email: formData.admin_email,
                        admin_password: formData.admin_password
                    })
                })

                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Failed to create company')
                showToast('Tạo công ty và tài khoản Admin thành công', 'success')
            }
            onSuccess()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-xl w-full max-w-2xl shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                    <h3 className="text-lg font-bold">{initialData ? 'Sửa Công Ty & Quản Lý Admin' : 'Thêm Công Ty Mới'}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="p-6 space-y-8">
                    {/* FORM CÔNG TY */}
                    <form id="company-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <h4 className="font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
                                <Building size={18} /> Thông tin Doanh Nghiệp
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Tên công ty <span className="text-red-500">*</span></label>
                                    <input name="name" value={formData.name} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" required placeholder="Nhập tên doanh nghiệp..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mã định danh (Slug) <span className="text-red-500">*</span></label>
                                    <input name="code" value={formData.code} onChange={handleChange} className="w-full p-2 border rounded-lg bg-gray-50 dark:bg-zinc-800 dark:border-zinc-700" required placeholder="tu-dong-tao" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Mã số thuế</label>
                                    <input name="tax_code" value={formData.tax_code} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="010xxxxxxx" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Số điện thoại</label>
                                    <input name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="Hotline..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email liên hệ</label>
                                    <input name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="contact@company.com" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1">Địa chỉ trụ sở</label>
                                    <input name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="Số nhà, đường, quận/huyện..." />
                                </div>
                            </div>
                        </div>

                        {/* NEW ADMIN (CREATE MODE) */}
                        {!initialData && (
                            <div className="space-y-4 pt-4 border-t border-dashed border-stone-200">
                                <h4 className="font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
                                    <Shield size={18} className="text-orange-500" /> Tạo Tài khoản Admin Mới
                                </h4>
                                <div className="p-4 bg-orange-50 dark:bg-zinc-800/50 rounded-xl space-y-4 border border-orange-100 dark:border-zinc-700">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Họ tên Admin <span className="text-red-500">*</span></label>
                                        <input name="admin_name" value={formData.admin_name} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="Nguyễn Văn Quản Trị" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Email đăng nhập <span className="text-red-500">*</span></label>
                                            <input name="admin_email" value={formData.admin_email} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="admin@company.com" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Mật khẩu khởi tạo <span className="text-red-500">*</span></label>
                                            <input type="password" name="admin_password" value={formData.admin_password} onChange={handleChange} className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700" placeholder="Min. 6 ký tự" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end gap-3 pt-4 border-t dark:border-zinc-800">
                            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800">Hủy</button>
                            <button type="submit" disabled={loading} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 font-medium shadow-lg shadow-orange-200">
                                {loading && <Loader2 className="animate-spin" size={16} />}
                                {initialData ? 'Lưu Thông Tin Công Ty' : 'Tạo Công Ty & Admin'}
                            </button>
                        </div>
                    </form>

                    {/* EDIT ADMIN (EDIT MODE ONLY) */}
                    {initialData && (
                        <div className="space-y-4 pt-4 border-t-2 border-dashed border-stone-200 dark:border-zinc-700">
                            <h4 className="font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300">
                                <Shield size={18} className="text-blue-500" /> Quản lý Admin
                            </h4>

                            {loadingAdmins ? (
                                <div className="text-sm text-center py-4 text-stone-500"><Loader2 className="animate-spin inline mr-2" /> Đang tải thông tin Admin...</div>
                            ) : admins.length === 0 ? (
                                <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                                    Công ty này chưa có tài khoản Admin nào.
                                </div>
                            ) : (
                                <div className="bg-blue-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-blue-100 dark:border-zinc-700">

                                    {/* Admin Selector (if multiple) */}
                                    {admins.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-blue-100 dark:border-zinc-700">
                                            {admins.map(admin => (
                                                <button
                                                    key={admin.id}
                                                    onClick={() => selectAdminForEdit(admin)}
                                                    className={`px-3 py-1 text-sm rounded-full border transition-colors whitespace-nowrap ${selectedAdmin?.id === admin.id
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                                                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                                        }`}
                                                >
                                                    {admin.full_name || admin.email}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {/* Add Admin Button */}
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsAddingAdmin(!isAddingAdmin)}
                                            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                        >
                                            {isAddingAdmin ? <><X size={14} /> Hủy thêm mới</> : <><Plus size={14} /> Thêm Admin khác</>}
                                        </button>
                                    </div>

                                    {/* Add Admin Form */}
                                    {isAddingAdmin && (
                                        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 animate-fade-in">
                                            <h5 className="text-sm font-bold text-blue-800 mb-3">Thêm Admin Mới</h5>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Họ tên Admin</label>
                                                    <input
                                                        name="new_admin_name"
                                                        value={formData.new_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full p-2 border rounded-lg"
                                                        placeholder="Nguyễn Văn A"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Email</label>
                                                        <input
                                                            name="new_admin_email"
                                                            value={formData.new_admin_email}
                                                            onChange={handleChange}
                                                            className="w-full p-2 border rounded-lg"
                                                            placeholder="admin2@company.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Mật khẩu</label>
                                                        <input
                                                            type="password"
                                                            name="new_admin_password"
                                                            value={formData.new_admin_password}
                                                            onChange={handleChange}
                                                            className="w-full p-2 border rounded-lg"
                                                            placeholder="Min. 6 ký tự"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddAdmin}
                                                        disabled={loading}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                                                    >
                                                        {loading && <Loader2 className="animate-spin" size={14} />}
                                                        Tạo Tài Khoản
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Edit Selected Admin */}
                                    {selectedAdmin && !isAddingAdmin && (
                                        <div className="space-y-4 animate-fade-in mt-4 border-t border-blue-100 pt-4">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                                    Đang sửa: {selectedAdmin.email}
                                                </h5>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="col-span-2">
                                                    <label className="block text-sm font-medium mb-1">Họ tên Admin</label>
                                                    <input
                                                        name="edit_admin_name"
                                                        value={formData.edit_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Email <span className="text-xs text-stone-400">(Tên đăng nhập)</span></label>
                                                    <input
                                                        name="edit_admin_email"
                                                        value={formData.edit_admin_email}
                                                        onChange={handleChange}
                                                        className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Đặt Mật khẩu Mới</label>
                                                    <input
                                                        type="password"
                                                        name="edit_admin_password"
                                                        value={formData.edit_admin_password}
                                                        onChange={handleChange}
                                                        className="w-full p-2 border rounded-lg dark:bg-zinc-800 dark:border-zinc-700 border-blue-300 focus:ring-blue-200"
                                                        placeholder="Để trống nếu không đổi"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    onClick={handleUpdateAdmin}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2 shadow-sm"
                                                >
                                                    {loading && <Loader2 className="animate-spin" size={14} />}
                                                    Cập nhật Admin
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty State Action */}
                            {initialData && admins.length === 0 && !loadingAdmins && (
                                <div className="mt-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingAdmin(!isAddingAdmin)}
                                        className="text-sm px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium inline-flex items-center gap-2"
                                    >
                                        {isAddingAdmin ? 'Hủy thêm mới' : <><Plus size={16} /> Thêm tài khoản Admin ngay</>}
                                    </button>

                                    {isAddingAdmin && (
                                        <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200 animate-fade-in text-left">
                                            <h5 className="text-sm font-bold text-blue-800 mb-3">Thêm Admin Mới</h5>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Họ tên Admin</label>
                                                    <input
                                                        name="new_admin_name"
                                                        value={formData.new_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full p-2 border rounded-lg"
                                                        placeholder="Nguyễn Văn A"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Email</label>
                                                        <input
                                                            name="new_admin_email"
                                                            value={formData.new_admin_email}
                                                            onChange={handleChange}
                                                            className="w-full p-2 border rounded-lg"
                                                            placeholder="admin2@company.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium mb-1">Mật khẩu</label>
                                                        <input
                                                            type="password"
                                                            name="new_admin_password"
                                                            value={formData.new_admin_password}
                                                            onChange={handleChange}
                                                            className="w-full p-2 border rounded-lg"
                                                            placeholder="Min. 6 ký tự"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddAdmin}
                                                        disabled={loading}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2"
                                                    >
                                                        {loading && <Loader2 className="animate-spin" size={14} />}
                                                        Tạo Tài Khoản
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
