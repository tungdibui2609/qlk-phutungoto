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
        <div className="fixed inset-0 bg-emerald-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-0 md:p-4">
            <div className="bg-white rounded-t-3xl md:rounded-2xl w-full max-w-2xl shadow-2xl animate-scale-in max-h-[92vh] md:max-h-[90vh] overflow-y-auto flex flex-col mt-auto md:mt-0">
                <div className="flex justify-between items-center p-5 border-b border-emerald-50 sticky top-0 bg-white/80 backdrop-blur-md z-10">
                    <h3 className="text-xl font-black text-emerald-800 tracking-tight">
                        {initialData ? 'Sửa Công Ty & Quản Lý Admin' : 'Thêm Công Ty Mới'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-emerald-50 text-emerald-400 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="p-5 md:p-8 space-y-10 flex-1">
                    {/* FORM CÔNG TY */}
                    <form id="company-form" onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-6">
                            <h4 className="font-black flex items-center gap-2 text-emerald-800 uppercase text-xs tracking-[0.2em]">
                                <Building size={16} /> Thông tin Doanh Nghiệp
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Tên công ty <span className="text-orange-500">*</span></label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-emerald-900 font-bold placeholder:text-emerald-300"
                                        required
                                        placeholder="Nhập tên doanh nghiệp..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Mã định danh (Slug) <span className="text-orange-500">*</span></label>
                                    <input
                                        name="code"
                                        value={formData.code}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-orange-50/30 border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-orange-700 font-mono font-bold"
                                        required
                                        placeholder="tu-dong-tao"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Mã số thuế</label>
                                    <input
                                        name="tax_code"
                                        value={formData.tax_code}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-emerald-900 font-bold placeholder:text-emerald-300"
                                        placeholder="010xxxxxxx"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Số điện thoại</label>
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-emerald-900 font-bold placeholder:text-emerald-300"
                                        placeholder="Hotline..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Email liên hệ</label>
                                    <input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-emerald-900 font-bold placeholder:text-emerald-300"
                                        placeholder="contact@company.com"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Địa chỉ trụ sở</label>
                                    <input
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-emerald-900 font-bold placeholder:text-emerald-300"
                                        placeholder="Số nhà, đường, quận/huyện..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* NEW ADMIN (CREATE MODE) */}
                        {!initialData && (
                            <div className="space-y-6 pt-6 border-t border-dashed border-emerald-100">
                                <h4 className="font-black flex items-center gap-2 text-emerald-800 uppercase text-xs tracking-[0.2em]">
                                    <Shield size={16} className="text-orange-500" /> Tạo Tài khoản Admin Mới
                                </h4>
                                <div className="p-5 bg-orange-50/50 rounded-2xl space-y-5 border border-orange-100">
                                    <div>
                                        <label className="block text-xs font-black text-orange-700 uppercase tracking-wider mb-2">Họ tên Admin <span className="text-orange-600">*</span></label>
                                        <input
                                            name="admin_name"
                                            value={formData.admin_name}
                                            onChange={handleChange}
                                            className="w-full p-3.5 bg-white border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-orange-800 font-bold placeholder:text-orange-200"
                                            placeholder="Nguyễn Văn Quản Trị"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-xs font-black text-orange-700 uppercase tracking-wider mb-2">Email đăng nhập <span className="text-orange-600">*</span></label>
                                            <input
                                                name="admin_email"
                                                value={formData.admin_email}
                                                onChange={handleChange}
                                                className="w-full p-3.5 bg-white border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-orange-800 font-bold placeholder:text-orange-200"
                                                placeholder="admin@company.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-orange-700 uppercase tracking-wider mb-2">Mật khẩu khởi tạo <span className="text-orange-600">*</span></label>
                                            <input
                                                type="password"
                                                name="admin_password"
                                                value={formData.admin_password}
                                                onChange={handleChange}
                                                className="w-full p-3.5 bg-white border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all text-orange-800 font-bold placeholder:text-orange-200"
                                                placeholder="Min. 6 ký tự"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col-reverse md:flex-row justify-end gap-3 pt-6 border-t border-emerald-50 bottom-0 bg-white z-10">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3.5 border border-emerald-100 rounded-xl hover:bg-emerald-50 text-emerald-600 font-bold transition-all text-center"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-3.5 bg-orange-600 text-white rounded-xl hover:bg-orange-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-black shadow-xl shadow-orange-100 transition-all uppercase tracking-widest text-xs"
                            >
                                {loading && <Loader2 className="animate-spin" size={16} />}
                                {initialData ? 'Lưu Thông Tin Công Ty' : 'Tạo Đặc Quyền Hệ Thống'}
                            </button>
                        </div>
                    </form>

                    {/* EDIT ADMIN (EDIT MODE ONLY) */}
                    {initialData && (
                        <div className="space-y-6 pt-8 border-t-2 border-dashed border-emerald-100">
                            <h4 className="font-black flex items-center gap-2 text-emerald-800 uppercase text-xs tracking-[0.2em]">
                                <Shield size={16} className="text-orange-500" /> Quản lý Admin
                            </h4>

                            {loadingAdmins ? (
                                <div className="text-sm text-center py-6 text-emerald-500 font-bold"><Loader2 className="animate-spin inline mr-2" /> Đang tải thông tin Admin...</div>
                            ) : admins.length === 0 ? (
                                <div className="text-xs font-bold text-orange-700 bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    Công ty này chưa có tài khoản Admin nào.
                                </div>
                            ) : (
                                <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100">

                                    {/* Admin Selector (if multiple) */}
                                    {admins.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-emerald-100">
                                            {admins.map(admin => (
                                                <button
                                                    key={admin.id}
                                                    onClick={() => selectAdminForEdit(admin)}
                                                    className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-all whitespace-nowrap ${selectedAdmin?.id === admin.id
                                                        ? 'bg-emerald-800 text-white border-emerald-800 shadow-lg shadow-emerald-100 scale-105'
                                                        : 'bg-white border-emerald-200 text-emerald-600 hover:bg-white hover:border-emerald-400'
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
                                            className="text-xs text-orange-600 hover:text-orange-700 font-black uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95"
                                        >
                                            {isAddingAdmin ? <><X size={14} /> Hủy thêm mới</> : <><Plus size={14} /> Thêm Admin khác</>}
                                        </button>
                                    </div>

                                    {/* Add Admin Form */}
                                    {isAddingAdmin && (
                                        <div className="mt-4 p-5 bg-white rounded-2xl border border-orange-100 shadow-xl shadow-emerald-900/5 animate-fade-in">
                                            <h5 className="text-xs font-black text-orange-700 uppercase tracking-widest mb-4">Thêm Admin Mới</h5>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Họ tên Admin</label>
                                                    <input
                                                        name="new_admin_name"
                                                        value={formData.new_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                        placeholder="Nguyễn Văn A"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Email</label>
                                                        <input
                                                            name="new_admin_email"
                                                            value={formData.new_admin_email}
                                                            onChange={handleChange}
                                                            className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                            placeholder="admin2@company.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Mật khẩu</label>
                                                        <input
                                                            type="password"
                                                            name="new_admin_password"
                                                            value={formData.new_admin_password}
                                                            onChange={handleChange}
                                                            className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                            placeholder="Min. 6 ký tự"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddAdmin}
                                                        disabled={loading}
                                                        className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 active:scale-95 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-orange-100"
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
                                        <div className="space-y-5 animate-fade-in mt-6 border-t border-emerald-100 pt-6">
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-black text-orange-800 uppercase tracking-[0.15em]">
                                                    Đang sửa: {selectedAdmin.email}
                                                </h5>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="md:col-span-2">
                                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Họ tên Admin</label>
                                                    <input
                                                        name="edit_admin_name"
                                                        value={formData.edit_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full p-3.5 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Email <span className="text-[10px] text-orange-400 font-black tracking-normal lowercase">(Tên đăng nhập)</span></label>
                                                    <input
                                                        name="edit_admin_email"
                                                        value={formData.edit_admin_email}
                                                        onChange={handleChange}
                                                        className="w-full p-3.5 bg-white border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Đặt Mật khẩu Mới</label>
                                                    <input
                                                        type="password"
                                                        name="edit_admin_password"
                                                        value={formData.edit_admin_password}
                                                        onChange={handleChange}
                                                        className="w-full p-3.5 bg-orange-50 border border-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-orange-900 font-bold"
                                                        placeholder="Để trống nếu không đổi"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex justify-end pt-2">
                                                <button
                                                    type="button"
                                                    onClick={handleUpdateAdmin}
                                                    disabled={loading}
                                                    className="px-6 py-3 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 active:scale-95 disabled:opacity-50 text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all"
                                                >
                                                    {loading && <Loader2 className="animate-spin" size={14} />}
                                                    Cập nhật Admin
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty State Action */}
                    {initialData && admins.length === 0 && !loadingAdmins && (
                        <div className="mt-4 text-center">
                            <button
                                type="button"
                                onClick={() => setIsAddingAdmin(!isAddingAdmin)}
                                className="px-6 py-3 bg-orange-100 text-orange-700 rounded-xl hover:bg-orange-200 font-black uppercase tracking-widest text-[10px] inline-flex items-center gap-2 transition-all active:scale-95"
                            >
                                {isAddingAdmin ? 'Hủy thêm mới' : <><Plus size={16} /> Thêm tài khoản Admin ngay</>}
                            </button>

                            {isAddingAdmin && (
                                <div className="mt-6 p-5 bg-white rounded-2xl border border-orange-100 shadow-xl shadow-orange-100/5 animate-fade-in text-left">
                                    <h5 className="text-xs font-black text-orange-800 uppercase tracking-widest mb-4">Thêm Admin Mới</h5>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Họ tên Admin</label>
                                            <input
                                                name="new_admin_name"
                                                value={formData.new_admin_name}
                                                onChange={handleChange}
                                                className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                placeholder="Nguyễn Văn A"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Email</label>
                                                <input
                                                    name="new_admin_email"
                                                    value={formData.new_admin_email}
                                                    onChange={handleChange}
                                                    className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                    placeholder="admin2@company.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-black text-emerald-700 uppercase tracking-wider mb-2">Mật khẩu</label>
                                                <input
                                                    type="password"
                                                    name="new_admin_password"
                                                    value={formData.new_admin_password}
                                                    onChange={handleChange}
                                                    className="w-full p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-emerald-900 font-bold"
                                                    placeholder="Min. 6 ký tự"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-2">
                                            <button
                                                type="button"
                                                onClick={handleAddAdmin}
                                                disabled={loading}
                                                className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 active:scale-95 text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-orange-100"
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
            </div>
        </div>
    )
}
