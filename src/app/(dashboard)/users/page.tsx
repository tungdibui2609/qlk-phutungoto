'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import { Plus, Search, Users, Edit, Trash2, Shield, CheckCircle, XCircle, Mail, Phone } from 'lucide-react'

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
    avatar_url: string | null
    role_id: string | null
    department: string | null
    is_active: boolean
    last_login: string | null
    created_at: string
    roles?: Role
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRole, setFilterRole] = useState<string>('all')

    useEffect(() => {
        fetchUsers()
        fetchRoles()
    }, [])

    async function fetchUsers() {
        setLoading(true)
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*, roles(id, code, name)')
            .order('full_name')

        if (data) setUsers(data)
        setLoading(false)
    }

    async function fetchRoles() {
        const { data } = await supabase.from('roles').select('*').order('name')
        if (data) setRoles(data)
    }

    async function toggleUserStatus(id: string, currentStatus: boolean) {
        const { error } = await (supabase.from('user_profiles') as any)
            .update({ is_active: !currentStatus })
            .eq('id', id)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            fetchUsers()
        }
    }

    const filteredUsers = users.filter(u => {
        const matchesSearch =
            u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (u.employee_code && u.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesRole = filterRole === 'all' || u.role_id === filterRole

        return matchesSearch && matchesRole
    })

    const getRoleBadgeColor = (code?: string) => {
        switch (code) {
            case 'admin': return 'bg-red-100 text-red-700'
            case 'manager': return 'bg-purple-100 text-purple-700'
            case 'warehouse': return 'bg-blue-100 text-blue-700'
            case 'sales': return 'bg-green-100 text-green-700'
            default: return 'bg-stone-100 text-stone-600'
        }
    }

    return (
        <div className="space-y-5">
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-stone-800">Quản lý Người dùng</h1>
                    <p className="text-stone-500 text-xs mt-0.5">Tạo tài khoản và phân quyền người dùng</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/users/roles"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:bg-stone-200 transition-colors"
                    >
                        <Shield size={16} />
                        Vai trò
                    </Link>
                    <Link
                        href="/users/new"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        <Plus size={16} />
                        Thêm người dùng
                    </Link>
                </div>
            </div>

            {/* SEARCH & FILTER */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, email, mã NV..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                    />
                </div>
                <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 focus:outline-none focus:border-orange-400"
                >
                    <option value="all">Tất cả vai trò</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-stone-500 text-sm">Đang tải...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-stone-500">
                        <Users className="mx-auto mb-2 opacity-30" size={40} />
                        <p className="text-sm">Chưa có người dùng nào</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-stone-50 border-b border-stone-200">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Người dùng</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Mã NV</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Liên hệ</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Vai trò</th>
                                <th className="text-left px-4 py-3 font-semibold text-stone-600">Phòng ban</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600">Trạng thái</th>
                                <th className="text-center px-4 py-3 font-semibold text-stone-600 w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                                                {user.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-stone-800">{user.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.employee_code ? (
                                            <span className="font-mono text-xs bg-stone-100 px-2 py-0.5 rounded">
                                                {user.employee_code}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="space-y-0.5">
                                            {user.email && (
                                                <div className="flex items-center gap-1 text-stone-600 text-xs">
                                                    <Mail size={12} />
                                                    {user.email}
                                                </div>
                                            )}
                                            {user.phone && (
                                                <div className="flex items-center gap-1 text-stone-600 text-xs">
                                                    <Phone size={12} />
                                                    {user.phone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {user.roles ? (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.roles.code)}`}>
                                                <Shield size={10} />
                                                {user.roles.name}
                                            </span>
                                        ) : (
                                            <span className="text-stone-400 text-xs">Chưa gán</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-stone-600">
                                        {user.department || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => toggleUserStatus(user.id, user.is_active)}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${user.is_active
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                                }`}
                                        >
                                            {user.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                            {user.is_active ? 'Hoạt động' : 'Vô hiệu'}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-1">
                                            <Link
                                                href={`/users/${user.id}`}
                                                className="p-1.5 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                            >
                                                <Edit size={14} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* STATS */}
            <div className="text-xs text-stone-500 text-right">
                Hiển thị {filteredUsers.length} / {users.length} người dùng
            </div>
        </div>
    )
}
