'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Search, Pencil, Trash2, X, Save, AlertCircle, Key } from 'lucide-react'

// Define the type locally since database.types.ts might not be updated yet
type Permission = {
    id: string
    code: string
    name: string
    description: string | null
    module: string
    created_at: string
}

export default function PermissionsPage() {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingPermission, setEditingPermission] = useState<Permission | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        module: '',
        description: ''
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchPermissions()
    }, [])

    async function fetchPermissions() {
        setLoading(true)
        const { data, error } = await supabase
            .from('permissions')
            .select('*')
            .order('module', { ascending: true })
            .order('code', { ascending: true })

        if (error) {
            console.error('Error fetching permissions:', error)
        } else {
            setPermissions(data as Permission[])
        }
        setLoading(false)
    }

    const filteredPermissions = permissions.filter(perm =>
        perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perm.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perm.module.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Group by module for better display
    const groupedPermissions = filteredPermissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
            acc[perm.module] = []
        }
        acc[perm.module].push(perm)
        return acc
    }, {} as Record<string, Permission[]>)

    const handleOpenModal = (perm?: Permission) => {
        if (perm) {
            setEditingPermission(perm)
            setFormData({
                code: perm.code,
                name: perm.name,
                module: perm.module,
                description: perm.description || ''
            })
        } else {
            setEditingPermission(null)
            setFormData({
                code: '',
                name: '',
                module: '',
                description: ''
            })
        }
        setError(null)
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            if (editingPermission) {
                // Update
                const { error } = await supabase
                    .from('permissions')
                    .update({
                        code: formData.code,
                        name: formData.name,
                        module: formData.module,
                        description: formData.description
                    })
                    .eq('id', editingPermission.id)

                if (error) throw error
            } else {
                // Create
                const { error } = await supabase
                    .from('permissions')
                    .insert([{
                        code: formData.code,
                        name: formData.name,
                        module: formData.module,
                        description: formData.description
                    }])

                if (error) throw error
            }

            // Refresh and close
            await fetchPermissions()
            setIsModalOpen(false)
        } catch (err: any) {
            console.error('Error saving permission:', err)
            setError(err.message || 'Có lỗi xảy ra khi lưu quyền.')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa quyền này không? Hành động này không thể hoàn tác.')) return

        try {
            const { error } = await supabase
                .from('permissions')
                .delete()
                .eq('id', id)

            if (error) throw error
            fetchPermissions()
        } catch (err: any) {
            console.error('Error deleting permission:', err)
            alert('Không thể xóa quyền này. Có thể nó đang được sử dụng.')
        }
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-stone-50">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                        <Key className="text-orange-500" />
                        Quản lý Phân quyền
                    </h1>
                    <p className="text-stone-500 text-sm mt-1">Định nghĩa các quyền hạn trong hệ thống</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} />
                    Thêm quyền mới
                </button>
            </div>

            {/* SEARCH */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-stone-200 mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên, mã quyền, hoặc nhóm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>
            </div>

            {/* LIST */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : Object.keys(groupedPermissions).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-12 text-center text-stone-500">
                    <AlertCircle className="mx-auto h-12 w-12 text-stone-300 mb-3" />
                    <p className="text-lg font-medium">Chưa có dữ liệu</p>
                    <p className="text-sm">Hãy tạo quyền mới để bắt đầu.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
                        <div key={moduleName} className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
                            <div className="bg-stone-50 px-6 py-3 border-b border-stone-200 flex items-center gap-2">
                                <span className="font-bold text-stone-700 uppercase tracking-wider text-sm">{moduleName}</span>
                                <span className="bg-stone-200 text-stone-600 text-xs px-2 py-0.5 rounded-full font-medium">{perms.length}</span>
                            </div>
                            <div className="divide-y divide-stone-100">
                                {perms.map((perm) => (
                                    <div key={perm.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors group">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold text-stone-800">{perm.name}</h3>
                                                <span className="text-xs font-mono bg-stone-100 text-stone-500 px-2 py-0.5 rounded border border-stone-200">
                                                    {perm.code}
                                                </span>
                                            </div>
                                            <p className="text-sm text-stone-500 mt-1">{perm.description || 'Chưa có mô tả'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(perm)}
                                                className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Chỉnh sửa"
                                            >
                                                <Pencil size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(perm.id)}
                                                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Xóa"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL */}
            {isModalOpen && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-all" onClick={() => setIsModalOpen(false)} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-stone-800">
                                {editingPermission ? 'Chỉnh sửa quyền' : 'Thêm quyền mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Mã quyền <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="VD: product.view"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                    <p className="text-xs text-stone-400 mt-1">Dùng để kiểm tra trong code</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-stone-700 mb-1">Nhóm (Module) <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="VD: Sản phẩm"
                                        value={formData.module}
                                        onChange={(e) => setFormData({ ...formData, module: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Tên quyền <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    placeholder="VD: Xem danh sách sản phẩm"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-stone-700 mb-1">Mô tả</label>
                                <textarea
                                    rows={3}
                                    placeholder="Mô tả chi tiết về quyền này..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-stone-600 hover:bg-stone-100 font-medium transition-colors"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Save size={18} />
                                    )}
                                    {editingPermission ? 'Lưu thay đổi' : 'Tạo mới'}
                                </button>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    )
}
