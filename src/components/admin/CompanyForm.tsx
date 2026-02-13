import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Save, X, User, Shield, Lock, Building, Plus, Check } from 'lucide-react'
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
        custom_domain: '',
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
                tax_code: initialData.tax_code || '',
                custom_domain: initialData.custom_domain || ''
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
            let updates = { ...prev, [name]: value }

            if (name === 'name' && !initialData) {
                updates.code = generateCode(value)
            }

            // Auto-clean domain input
            if (name === 'custom_domain') {
                updates.custom_domain = value.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
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
                    tax_code: formData.tax_code,
                    custom_domain: formData.custom_domain || null
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
                        custom_domain: formData.custom_domain,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">
                            {initialData ? 'Cập nhật thông tin công ty' : 'Thêm công ty mới'}
                        </h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {initialData ? 'Quản lý thông tin và tài khoản quản trị' : 'Điền thông tin để tạo không gian làm việc mới'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
                    <form id="company-form" onSubmit={handleSubmit}>
                        {/* Section: Thông tin doanh nghiệp */}
                        <div className="space-y-5">
                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                                <Building size={16} className="text-amber-500" />
                                Thông tin doanh nghiệp
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên công ty <span className="text-red-500">*</span></label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 font-medium"
                                        required
                                        placeholder="Ví dụ: Công ty Cổ phần Toàn Thắng"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mã định danh (Slug) <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input
                                            name="code"
                                            value={formData.code}
                                            onChange={handleChange}
                                            className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 font-mono text-sm"
                                            required
                                            placeholder="tu-dong-tao"
                                        />
                                        <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                                            <Lock size={14} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1.5 pl-1">Mã dùng để định danh trên URL hệ thống</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mã số thuế</label>
                                    <input
                                        name="tax_code"
                                        value={formData.tax_code}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="010xxxxxxx"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên miền riêng (Custom Domain)</label>
                                    <input
                                        name="custom_domain"
                                        value={formData.custom_domain}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="ví dụ: khachhang.com (Không bắt buộc)"
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5 pl-1">Trỏ tên miền về server để kích hoạt.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Số điện thoại</label>
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="0987..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email liên hệ</label>
                                    <input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="contact@company.com"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Địa chỉ trụ sở</label>
                                    <input
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Tài khoản Admin (Chỉ hiện khi tạo mới) */}
                        {!initialData && (
                            <div className="space-y-5 pt-2">
                                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                                    <User size={16} className="text-amber-500" />
                                    Tài khoản quản trị viên (Admin)
                                </h4>

                                <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-100 space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-slate-800 mb-1.5">Họ và tên <span className="text-red-500">*</span></label>
                                            <input
                                                name="admin_name"
                                                value={formData.admin_name}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-amber-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                                placeholder="Nhập họ tên người quản trị..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-800 mb-1.5">Email đăng nhập <span className="text-red-500">*</span></label>
                                            <input
                                                name="admin_email"
                                                value={formData.admin_email}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-amber-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                                placeholder="admin@company.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-slate-800 mb-1.5">Mật khẩu khởi tạo <span className="text-red-500">*</span></label>
                                            <input
                                                type="password"
                                                name="admin_password"
                                                value={formData.admin_password}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-amber-200 bg-white text-slate-900 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400"
                                                placeholder="Tối thiểu 6 ký tự"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3 p-3 bg-amber-100/50 rounded-lg text-xs text-amber-800">
                                        <Shield size={16} className="mt-0.5 shrink-0 text-amber-600" />
                                        <p>Tài khoản này sẽ được cấp quyền <strong>Super Admin</strong> cho công ty mới. Vui lòng ghi nhớ thông tin đăng nhập.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Section: Quản lý Admin (Chỉ hiện khi sửa) */}
                    {initialData && (
                        <div className="space-y-5 pt-2">
                            <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
                                <User size={16} className="text-amber-500" />
                                Quản lý tài khoản Admin
                            </h4>

                            {loadingAdmins ? (
                                <div className="flex items-center justify-center py-8 text-slate-400">
                                    <Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Admin List Tabs */}
                                    {admins.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {admins.map(admin => (
                                                <button
                                                    key={admin.id}
                                                    onClick={() => selectAdminForEdit(admin)}
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${selectedAdmin?.id === admin.id
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                                        }`}
                                                >
                                                    {admin.full_name || admin.email}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => setIsAddingAdmin(!isAddingAdmin)}
                                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-dashed flex items-center gap-1.5 ${isAddingAdmin
                                                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                                                    : 'text-slate-500 border-slate-300 hover:text-amber-600 hover:border-amber-300'
                                                    }`}
                                            >
                                                {isAddingAdmin ? <X size={14} /> : <Plus size={14} />}
                                                {isAddingAdmin ? 'Hủy thêm mới' : 'Thêm Admin'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                            <p className="text-sm text-slate-500 mb-3">Chưa có tài khoản quản trị viên nào.</p>
                                            <button
                                                onClick={() => setIsAddingAdmin(true)}
                                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:text-amber-600 hover:border-amber-300 transition-colors shadow-sm"
                                            >
                                                + Thêm Admin đầu tiên
                                            </button>
                                        </div>
                                    )}

                                    {/* Form: Add New Admin */}
                                    {isAddingAdmin && (
                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 animate-in fade-in slide-in-from-top-2">
                                            <h5 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Thêm Administrator mới
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Họ và tên</label>
                                                    <input
                                                        name="new_admin_name"
                                                        value={formData.new_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                                                        placeholder="Nhập họ tên..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                                                    <input
                                                        name="new_admin_email"
                                                        value={formData.new_admin_email}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                                                        placeholder="admin@..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mật khẩu</label>
                                                    <input
                                                        type="password"
                                                        name="new_admin_password"
                                                        value={formData.new_admin_password}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                                                        placeholder="******"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end mt-4">
                                                <button
                                                    type="button"
                                                    onClick={handleAddAdmin}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors flex items-center gap-2"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                                    Xác nhận thêm
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Form: Edit Selected Admin */}
                                    {selectedAdmin && !isAddingAdmin && (
                                        <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 animate-in fade-in">
                                            <h5 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Sửa thông tin: <span className="text-slate-500 font-normal">{selectedAdmin.email}</span>
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Họ và tên</label>
                                                    <input
                                                        name="edit_admin_name"
                                                        value={formData.edit_admin_name}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email (Login)</label>
                                                    <input
                                                        name="edit_admin_email"
                                                        value={formData.edit_admin_email}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Δổi mật khẩu</label>
                                                    <input
                                                        type="password"
                                                        name="edit_admin_password"
                                                        value={formData.edit_admin_password}
                                                        onChange={handleChange}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-slate-400 text-sm"
                                                        placeholder="Để trống nếu không đổi..."
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end mt-4">
                                                <button
                                                    type="button"
                                                    onClick={handleUpdateAdmin}
                                                    disabled={loading}
                                                    className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors flex items-center gap-2"
                                                >
                                                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                                    Lưu thay đổi
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-white hover:text-slate-900 transition-colors"
                    >
                        Đóng
                    </button>
                    {!isAddingAdmin && (initialData ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                // Trigger form submit manually because button is outside form
                                const form = document.getElementById('company-form') as HTMLFormElement;
                                if (form) form.requestSubmit();
                            }}
                            disabled={loading}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Lưu Thông Tin Công Ty
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => {
                                const form = document.getElementById('company-form') as HTMLFormElement;
                                if (form) form.requestSubmit();
                            }}
                            disabled={loading}
                            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18} /> : <span>+</span>}
                            Tạo Công Ty Mới
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
