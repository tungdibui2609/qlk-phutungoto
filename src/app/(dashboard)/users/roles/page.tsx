'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { ArrowLeft, Shield, Edit, Save, X, Loader2, Check } from 'lucide-react'

interface Role {
    id: string
    code: string
    name: string
    description: string | null
    permissions: string[]
    is_system: boolean
    created_at: string
}

const AVAILABLE_PERMISSIONS = [
    { key: 'all', label: 'Toàn quyền', group: 'Hệ thống' },
    { key: 'products.view', label: 'Xem sản phẩm', group: 'Sản phẩm' },
    { key: 'products.edit', label: 'Sửa sản phẩm', group: 'Sản phẩm' },
    { key: 'inventory.view', label: 'Xem tồn kho', group: 'Kho' },
    { key: 'inventory.edit', label: 'Sửa tồn kho', group: 'Kho' },
    { key: 'operations.inbound', label: 'Nhập kho', group: 'Kho' },
    { key: 'operations.outbound', label: 'Xuất kho', group: 'Kho' },
    { key: 'customers.view', label: 'Xem khách hàng', group: 'Khách hàng' },
    { key: 'customers.edit', label: 'Sửa khách hàng', group: 'Khách hàng' },
    { key: 'suppliers.view', label: 'Xem NCC', group: 'NCC' },
    { key: 'suppliers.edit', label: 'Sửa NCC', group: 'NCC' },
    { key: 'reports.view', label: 'Xem báo cáo', group: 'Báo cáo' },
    { key: 'users.view', label: 'Xem người dùng', group: 'Người dùng' },
    { key: 'users.edit', label: 'Quản lý người dùng', group: 'Người dùng' },
]

export default function RolesPage() {
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editData, setEditData] = useState({ name: '', description: '', permissions: [] as string[] })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchRoles()
    }, [])

    async function fetchRoles() {
        setLoading(true)
        const { data, error } = await supabase
            .from('roles')
            .select('*')
            .order('is_system', { ascending: false })
            .order('name')

        if (data) setRoles(data)
        setLoading(false)
    }

    const startEdit = (role: Role) => {
        setEditingId(role.id)
        setEditData({
            name: role.name,
            description: role.description || '',
            permissions: role.permissions || []
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditData({ name: '', description: '', permissions: [] })
    }

    const togglePermission = (perm: string) => {
        setEditData(prev => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm]
        }))
    }

    const saveRole = async () => {
        if (!editingId) return
        setSaving(true)

        const { error } = await supabase
            .from('roles')
            .update({
                name: editData.name,
                description: editData.description || null,
                permissions: editData.permissions
            })
            .eq('id', editingId)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            cancelEdit()
            fetchRoles()
        }
        setSaving(false)
    }

    const getRoleBadgeColor = (code: string) => {
        switch (code) {
            case 'admin': return 'bg-red-100 text-red-700 border-red-200'
            case 'manager': return 'bg-purple-100 text-purple-700 border-purple-200'
            case 'warehouse': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'sales': return 'bg-green-100 text-green-700 border-green-200'
            default: return 'bg-stone-100 text-stone-600 border-stone-200'
        }
    }

    return (
        <div className="space-y-5">
            {/* HEADER */}
            <div className="flex items-center gap-3">
                <Link
                    href="/users"
                    className="p-2 rounded-lg bg-stone-100 border border-stone-200 text-stone-500 hover:border-orange-300 hover:text-orange-600 transition-colors"
                >
                    <ArrowLeft size={18} />
                </Link>
                <div>
                    <h1 className="text-xl font-bold text-stone-800">Vai trò & Phân quyền</h1>
                    <p className="text-stone-500 text-xs mt-0.5">Quản lý các vai trò và quyền hạn trong hệ thống</p>
                </div>
            </div>

            {/* ROLES LIST */}
            <div className="space-y-4">
                {loading ? (
                    <div className="p-8 text-center text-stone-500 text-sm">Đang tải...</div>
                ) : roles.map((role) => (
                    <div key={role.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                        <div className="p-4 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${getRoleBadgeColor(role.code)}`}>
                                    <Shield size={18} />
                                </div>
                                <div>
                                    {editingId === role.id ? (
                                        <input
                                            value={editData.name}
                                            onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                            className="font-semibold text-stone-800 px-2 py-1 rounded border border-orange-300 focus:outline-none text-sm"
                                        />
                                    ) : (
                                        <h3 className="font-semibold text-stone-800">{role.name}</h3>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="font-mono text-xs text-stone-400">{role.code}</span>
                                        {role.is_system && (
                                            <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Hệ thống</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {editingId === role.id ? (
                                    <>
                                        <button
                                            onClick={saveRole}
                                            disabled={saving}
                                            className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                                        >
                                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => startEdit(role)}
                                        className="p-1.5 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                    >
                                        <Edit size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="px-4 pb-3">
                            {editingId === role.id ? (
                                <input
                                    value={editData.description}
                                    onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full text-sm text-stone-600 px-2 py-1 rounded border border-stone-200 focus:outline-none focus:border-orange-300"
                                    placeholder="Mô tả vai trò..."
                                />
                            ) : (
                                <p className="text-sm text-stone-500">{role.description || 'Không có mô tả'}</p>
                            )}
                        </div>

                        {/* Permissions */}
                        <div className="px-4 pb-4 border-t border-stone-100 pt-3">
                            <p className="text-xs font-medium text-stone-500 mb-2">Quyền hạn:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {editingId === role.id ? (
                                    AVAILABLE_PERMISSIONS.map(perm => (
                                        <button
                                            key={perm.key}
                                            type="button"
                                            onClick={() => togglePermission(perm.key)}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${editData.permissions.includes(perm.key)
                                                    ? 'bg-orange-100 text-orange-700'
                                                    : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                                }`}
                                        >
                                            {editData.permissions.includes(perm.key) && <Check size={10} />}
                                            {perm.label}
                                        </button>
                                    ))
                                ) : (
                                    role.permissions?.map((perm: string) => (
                                        <span key={perm} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-stone-100 text-stone-600">
                                            <Check size={10} className="text-green-500" />
                                            {AVAILABLE_PERMISSIONS.find(p => p.key === perm)?.label || perm}
                                        </span>
                                    )) || <span className="text-xs text-stone-400">Không có quyền</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
