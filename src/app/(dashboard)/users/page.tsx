'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { logActivity } from '@/lib/audit'
import AuditLogViewer from '@/components/shared/AuditLogViewer'
import Link from 'next/link'
import { Plus, Search, Users, Edit, Shield, CheckCircle, XCircle, Mail, Phone, History, Copy } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import MobileUserList from '@/components/users/MobileUserList'

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
    is_active: boolean | null
    last_login: string | null
    created_at: string | null
    roles?: Role | null
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filterRole, setFilterRole] = useState<string>('all')
    const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null)

    async function fetchUsers() {
        setLoading(true)
        const { data } = await supabase
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

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUsers()
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchRoles()
    }, [])

    async function toggleUserStatus(id: string, currentStatus: boolean) {
        // Fetch old data for audit
        const oldUser = users.find(u => u.id === id);

        const { error } = await supabase.from('user_profiles')
            .update({ is_active: !currentStatus })
            .eq('id', id)

        if (error) {
            alert('Lỗi: ' + error.message)
        } else {
            // Log Activity
            if (oldUser) {
                await logActivity({
                    supabase,
                    tableName: 'user_profiles',
                    recordId: id,
                    action: 'UPDATE',
                    oldData: { is_active: currentStatus },
                    newData: { is_active: !currentStatus }
                })
            }
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-stone-800">Quản lý Người dùng</h1>
                    <p className="text-stone-500 text-xs mt-0.5">Tạo tài khoản và phân quyền người dùng</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href="/users/roles"
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 bg-stone-100 border border-stone-200 hover:bg-stone-200 transition-colors"
                    >
                        <Shield size={16} />
                        <span className="hidden sm:inline">Vai trò</span>
                        <span className="sm:hidden">Vai trò</span>
                    </Link>
                    <Link
                        href="/users/new"
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5"
                        style={{
                            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                            boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                        }}
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">Thêm người dùng</span>
                        <span className="sm:hidden">Thêm mới</span>
                    </Link>
                </div>
            </div>

            {/* SEARCH & FILTER */}
            <div className="bg-white rounded-xl p-4 border border-stone-200 flex flex-col md:flex-row items-center gap-4">
                <div className="relative flex-1 w-full md:max-w-md">
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
                    className="w-full md:w-auto px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm text-stone-700 focus:outline-none focus:border-orange-400"
                >
                    <option value="all">Tất cả vai trò</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500 text-sm">Đang tải...</div>
            ) : filteredUsers.length === 0 ? (
                <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-500">
                    <Users className="mx-auto mb-2 opacity-30" size={40} />
                    <p className="text-sm">Chưa có người dùng nào</p>
                </div>
            ) : (
                <>
                    {/* MOBILE LIST */}
                    <div className="md:hidden">
                        <MobileUserList users={filteredUsers} onToggleStatus={toggleUserStatus} />
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block bg-white rounded-xl border border-stone-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-stone-50 border-b border-stone-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-stone-600">Người dùng</th>
                                    <th className="text-left px-4 py-3 font-semibold text-stone-600">Mã NV</th>
                                    <th className="text-left px-4 py-3 font-semibold text-stone-600">Tên đăng nhập</th>
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
                                            {user.email ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-stone-700 text-sm">
                                                        {user.email.endsWith('@system.local')
                                                            ? user.email.replace('@system.local', '')
                                                            : user.email}
                                                    </span>
                                                    <button
                                                        onClick={() => {
                                                            const username = user.email?.endsWith('@system.local')
                                                                ? user.email.replace('@system.local', '')
                                                                : user.email;
                                                            navigator.clipboard.writeText(username || '')
                                                            // Optional: simple visual feedback could be added here
                                                        }}
                                                        className="text-stone-400 hover:text-orange-500 transition-colors p-1 rounded-md hover:bg-stone-100"
                                                        title="Copy Tên đăng nhập"
                                                    >
                                                        <Copy size={14} />
                                                    </button>
                                                </div>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!user.employee_code ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-800 text-white shadow-sm">
                                                    <Shield size={10} />
                                                    Quản trị viên
                                                </span>
                                            ) : user.roles ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.roles.code)}`}>
                                                    <Shield size={10} />
                                                    {user.roles.name}
                                                </span>
                                            ) : (
                                                <span className="text-stone-400 text-xs">Chưa gán</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-stone-600">
                                            {!user.employee_code ? (
                                                <span className="text-stone-500 italic text-xs">Hệ thống</span>
                                            ) : (
                                                user.department || '-'
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <Protected permission="user.manage">
                                                <button
                                                    onClick={() => toggleUserStatus(user.id, user.is_active ?? false)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${user.is_active
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                                        }`}
                                                >
                                                    {user.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                    {user.is_active ? 'Hoạt động' : 'Vô hiệu'}
                                                </button>
                                            </Protected>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <Protected permission="user.manage">
                                                    <Link
                                                        href={`/users/${user.id}`}
                                                        className="p-1.5 rounded-lg text-stone-500 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                                    >
                                                        <Edit size={14} />
                                                    </Link>
                                                    <button
                                                        onClick={() => setViewingHistoryId(user.id)}
                                                        className="p-1.5 rounded-lg text-stone-500 hover:bg-purple-50 hover:text-purple-600 transition-colors"
                                                        title="Lịch sử hoạt động"
                                                    >
                                                        <History size={14} />
                                                    </button>
                                                </Protected>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <AuditLogViewer
                // When viewing user history, we want to see ACTIONS performed BY the user (Activity Log)
                // rather than changes to the user profile itself.
                userId={viewingHistoryId || ''}
                isOpen={!!viewingHistoryId}
                onClose={() => setViewingHistoryId(null)}
                title="Nhật ký hoạt động người dùng"
            />

            {/* STATS */}
            <div className="text-xs text-stone-500 text-right">
                Hiển thị {filteredUsers.length} / {users.length} người dùng
            </div>
        </div>
    )
}
