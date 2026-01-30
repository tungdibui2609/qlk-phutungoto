'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Search, Users, Phone, Mail, Shield } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'

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
}

export default function ConstructionMembersPage() {
    const { profile } = useUser()
    const [members, setMembers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchMembers()
    }, [])

    async function fetchMembers() {
        setLoading(true)
        // For prototype: fetch all users, later filter by 'Construction' department or project assignment
        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('full_name')

        if (!error && data) {
            setMembers(data)
        }
        setLoading(false)
    }

    const filteredMembers = members.filter(m =>
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.employee_code && m.employee_code.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thành viên & Đội nhóm</h2>
                    <p className="text-sm text-gray-500">Quản lý danh sách nhân sự, chỉ huy trưởng và các đội thi công</p>
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2">
                    <Plus size={16} />
                    Thêm thành viên
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Tìm theo tên, mã nhân viên..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Members List */}
            {loading ? (
                <div className="text-center py-10 text-gray-500">Đang tải danh sách...</div>
            ) : filteredMembers.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <Users className="mx-auto text-gray-300 mb-2" size={48} />
                    <p className="text-gray-500">Không tìm thấy thành viên nào</p>
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                            <tr>
                                <th className="text-left px-6 py-3 font-medium text-gray-500">Họ và tên</th>
                                <th className="text-left px-6 py-3 font-medium text-gray-500">Mã NV</th>
                                <th className="text-left px-6 py-3 font-medium text-gray-500">Liên hệ</th>
                                <th className="text-left px-6 py-3 font-medium text-gray-500">Vai trò / Chức vụ</th>
                                <th className="text-center px-6 py-3 font-medium text-gray-500">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredMembers.map((member) => (
                                <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                {member.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-gray-900 dark:text-gray-200">
                                                {member.full_name}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {member.employee_code || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {member.phone && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs">
                                                    <Phone size={12} />
                                                    {member.phone}
                                                </div>
                                            )}
                                            {member.email && (
                                                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs">
                                                    <Mail size={12} />
                                                    {member.email}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Shield size={14} className="text-gray-400" />
                                            <span className="text-gray-600 dark:text-gray-300">
                                                {member.department || 'Thành viên'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                            member.is_active
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                            {member.is_active ? 'Đang hoạt động' : 'Đã nghỉ'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
