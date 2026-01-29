'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Search, Pencil, Trash2, X, Save, AlertCircle, Shield, Check, Key } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { useUser } from '@/contexts/UserContext'


type Role = {
    id: string
    code: string
    name: string
    description: string | null
    permissions: string[] | null // Array of permission codes
    is_system: boolean
}

type Permission = {
    id: string
    code: string
    name: string
    module: string
}

export default function RolesPage() {
    const { profile } = useUser()
    const [roles, setRoles] = useState<Role[]>([])
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingRole, setEditingRole] = useState<Role | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        permissions: [] as string[]
    })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchData()
    }, [])

    async function fetchData() {
        setLoading(true)
        const [rolesRes, permsRes] = await Promise.all([
            supabase.from('roles').select('*').order('name'),
            supabase.from('permissions').select('*').order('module').order('code')
        ])

        if (rolesRes.data) setRoles(rolesRes.data as Role[])
        if (permsRes.data) setPermissions(permsRes.data as Permission[])

        setLoading(false)
    }

    // Group permissions by module
    const groupedPermissions = permissions.reduce((acc, perm) => {
        if (!acc[perm.module]) {
            acc[perm.module] = []
        }
        acc[perm.module].push(perm)
        return acc
    }, {} as Record<string, Permission[]>)

    const handleOpenModal = (role?: Role) => {
        if (role) {
            setEditingRole(role)
            setFormData({
                code: role.code,
                name: role.name,
                description: role.description || '',
                permissions: role.permissions || []
            })
        } else {
            setEditingRole(null)
            setFormData({
                code: '',
                name: '',
                description: '',
                permissions: []
            })
        }
        setError(null)
        setIsModalOpen(true)
    }

    const togglePermission = (code: string) => {
        setFormData(prev => {
            const exists = prev.permissions.includes(code)
            if (exists) {
                return { ...prev, permissions: prev.permissions.filter(p => p !== code) }
            } else {
                return { ...prev, permissions: [...prev.permissions, code] }
            }
        })
    }

    const toggleModulePermissions = (moduleName: string) => {
        const modulePermCodes = groupedPermissions[moduleName].map(p => p.code)
        const allSelected = modulePermCodes.every(code => formData.permissions.includes(code))

        if (allSelected) {
            // Deselect all
            setFormData(prev => ({
                ...prev,
                permissions: prev.permissions.filter(p => !modulePermCodes.includes(p))
            }))
        } else {
            // Select all (add missing ones)
            setFormData(prev => {
                const newPerms = new Set([...prev.permissions, ...modulePermCodes])
                return { ...prev, permissions: Array.from(newPerms) }
            })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setError(null)

        try {
            if (editingRole) {
                const { error } = await (supabase
                    .from('roles') as any)
                    .update({
                        code: formData.code,
                        name: formData.name,
                        description: formData.description,
                        permissions: formData.permissions
                    })
                    .eq('id', editingRole.id)
                if (error) throw error
            } else {
                const { error } = await (supabase
                    .from('roles') as any)
                    .insert([{
                        code: formData.code,
                        name: formData.name,
                        description: formData.description,
                        permissions: formData.permissions,
                        company_id: profile?.company_id
                    }])
                if (error) throw error
            }
            fetchData()
            setIsModalOpen(false)
        } catch (err: any) {
            console.error('Error saving role:', err)
            setError(err.message || 'Lỗi khi lưu vai trò')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (role: Role) => {
        if (role.is_system) {
            alert('Không thể xóa vai trò hệ thống mặc định.')
            return
        }
        if (!confirm('Bạn có chắc chắn muốn xóa vai trò này không?')) return

        const { error } = await supabase.from('roles').delete().eq('id', role.id)
        if (error) {
            alert('Không thể xóa (có thể đang có người dùng thuộc vai trò này)')
        } else {
            fetchData()
        }
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto min-h-screen bg-stone-50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2">
                        <Shield className="text-orange-500" />
                        Quản lý Vai trò & Phân quyền
                    </h1>
                    <p className="text-stone-500 text-sm mt-1">Định nghĩa vai trò và gán quyền hạn truy cập</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-medium"
                >
                    <Plus size={18} />
                    Thêm vai trò mới
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {roles.map(role => (
                        <div key={role.id} className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:border-orange-300 transition-all flex flex-col h-full">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="font-bold text-lg text-stone-800">{role.name}</h3>
                                    <span className="text-xs font-mono bg-stone-100 text-stone-500 px-2 py-0.5 rounded border border-stone-200 mt-1 inline-block">
                                        {role.code}
                                    </span>
                                </div>
                                {role.is_system && (
                                    <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                                        Hệ thống
                                    </span>
                                )}
                            </div>

                            <p className="text-sm text-stone-500 mb-4 flex-1 line-clamp-3">
                                {role.description || 'Chưa có mô tả'}
                            </p>

                            <div className="border-t border-stone-100 pt-4 flex items-center justify-between">
                                <div className="text-xs font-semibold text-stone-500">
                                    {(role.permissions || []).length} quyền hạn
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenModal(role)}
                                        className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                        title="Chỉnh sửa"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    {!role.is_system && (
                                        <button
                                            onClick={() => handleDelete(role)}
                                            className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            title="Xóa"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MODAL */}
            {isModalOpen && (
                <>
                    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-all" onClick={() => setIsModalOpen(false)} />
                    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200 flex items-center justify-between flex-shrink-0">
                            <h3 className="text-lg font-bold text-stone-800">
                                {editingRole ? `Sửa vai trò: ${editingRole.name}` : 'Thêm vai trò mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body - Scrollable */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-stone-700 mb-1">Mã vai trò <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 uppercase"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-stone-700 mb-1">Tên vai trò <span className="text-red-500">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <label className="block text-sm font-medium text-stone-700 mb-1">Mô tả</label>
                                        <textarea
                                            rows={2}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-stone-100 pt-4">
                                    <h4 className="font-bold text-stone-800 mb-4 flex items-center gap-2">
                                        <Key size={18} className="text-orange-500" />
                                        Phân quyền chi tiết
                                    </h4>

                                    <div className="space-y-6">
                                        {Object.entries(groupedPermissions).map(([moduleName, perms]) => {
                                            const allSelected = perms.every(p => formData.permissions.includes(p.code))
                                            return (
                                                <div key={moduleName} className="bg-stone-50 rounded-xl p-4 border border-stone-100">
                                                    <div className="flex items-center justify-between mb-3 border-b border-stone-200 pb-2">
                                                        <span className="font-bold text-stone-700 uppercase text-sm tracking-wide">{moduleName}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleModulePermissions(moduleName)}
                                                            className="text-xs font-medium text-orange-600 hover:text-orange-700 hover:underline"
                                                        >
                                                            {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                        {perms.map(perm => {
                                                            const isChecked = formData.permissions.includes(perm.code)
                                                            return (
                                                                <label
                                                                    key={perm.id}
                                                                    className={`
                                                                        flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all select-none
                                                                        ${isChecked
                                                                            ? 'bg-white border-orange-300 shadow-sm'
                                                                            : 'bg-transparent border-transparent hover:bg-stone-100'
                                                                        }
                                                                    `}
                                                                >
                                                                    <div className={`
                                                                        flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors
                                                                        ${isChecked
                                                                            ? 'bg-orange-500 border-orange-500 text-white'
                                                                            : 'bg-white border-stone-300 text-transparent'
                                                                        }
                                                                    `}>
                                                                        <Check size={14} strokeWidth={3} />
                                                                    </div>
                                                                    <input
                                                                        type="checkbox"
                                                                        className="hidden"
                                                                        checked={isChecked}
                                                                        onChange={() => togglePermission(perm.code)}
                                                                    />
                                                                    <span className={`text-sm ${isChecked ? 'font-medium text-orange-900' : 'text-stone-600'}`}>
                                                                        {perm.name}
                                                                    </span>
                                                                </label>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </form>

                        {/* Footer - Fixed */}
                        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 rounded-lg text-stone-600 hover:bg-stone-100 font-medium transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="px-6 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save size={18} />
                                )}
                                Lưu vai trò
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
