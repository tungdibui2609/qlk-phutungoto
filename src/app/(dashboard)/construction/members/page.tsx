'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Search, Users, Phone, Shield, Briefcase, Filter, MoreHorizontal } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import TeamModal from '@/components/construction/TeamModal'
import MemberModal from '@/components/construction/MemberModal'
import { useToast } from '@/components/ui/ToastProvider'

// Define types locally since they are new
export interface ConstructionTeam {
    id: string
    name: string
    code: string | null
    description: string | null
    created_at: string
}

export interface ConstructionMember {
    id: string
    full_name: string
    phone: string | null
    role: string | null
    team_id: string | null
    is_active: boolean
    teams?: ConstructionTeam // For join
}

export default function ConstructionMembersPage() {
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()
    const [activeTab, setActiveTab] = useState<'members' | 'teams'>('members')

    // Data state
    const [members, setMembers] = useState<ConstructionMember[]>([])
    const [teams, setTeams] = useState<ConstructionTeam[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal state
    const [isTeamModalOpen, setIsTeamModalOpen] = useState(false)
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
    const [editingTeam, setEditingTeam] = useState<ConstructionTeam | null>(null)
    const [editingMember, setEditingMember] = useState<ConstructionMember | null>(null)

    useEffect(() => {
        if (profile) {
            fetchData()
        }
    }, [profile, activeTab])

    async function fetchData() {
        setLoading(true)
        if (activeTab === 'members') {
            const { data, error } = await (supabase
                .from('construction_members') as any)
                .select('*, teams:team_id(id, name)')
                .order('full_name')

            if (error) showToast('Lỗi tải danh sách: ' + error.message, 'error')
            else setMembers(data || [])
        } else {
            const { data, error } = await (supabase
                .from('construction_teams') as any)
                .select('*')
                .order('name')

            if (error) showToast('Lỗi tải danh sách: ' + error.message, 'error')
            else setTeams(data || [])
        }
        setLoading(false)
    }

    // Handlers for Member
    const handleCreateMember = () => {
        setEditingMember(null)
        setIsMemberModalOpen(true)
    }

    const handleEditMember = (member: ConstructionMember) => {
        setEditingMember(member)
        setIsMemberModalOpen(true)
    }

    const handleDeleteMember = async (id: string) => {
        if (!await showConfirm('Bạn có chắc muốn xóa thành viên này?')) return
        const { error } = await (supabase.from('construction_members') as any).delete().eq('id', id)
        if (error) showToast('Lỗi xóa: ' + error.message, 'error')
        else {
            showToast('Đã xóa thành công', 'success')
            setMembers(prev => prev.filter(m => m.id !== id))
        }
    }

    // Handlers for Team
    const handleCreateTeam = () => {
        setEditingTeam(null)
        setIsTeamModalOpen(true)
    }

    const handleEditTeam = (team: ConstructionTeam) => {
        setEditingTeam(team)
        setIsTeamModalOpen(true)
    }

    const handleDeleteTeam = async (id: string) => {
        if (!await showConfirm('Bạn có chắc muốn xóa đội này?')) return
        const { error } = await (supabase.from('construction_teams') as any).delete().eq('id', id)
        if (error) showToast('Lỗi xóa: ' + error.message, 'error')
        else {
            showToast('Đã xóa thành công', 'success')
            setTeams(prev => prev.filter(t => t.id !== id))
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thành viên & Đội thi công</h2>
                    <p className="text-sm text-gray-500">Quản lý nhân sự thủ công và phân đội cho công trình</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            activeTab === 'members'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Thành viên
                    </button>
                    <button
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            activeTab === 'teams'
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        Đội thi công
                    </button>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder={activeTab === 'members' ? "Tìm theo tên, SĐT..." : "Tìm tên đội..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={activeTab === 'members' ? handleCreateMember : handleCreateTeam}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                    <Plus size={16} />
                    {activeTab === 'members' ? 'Thêm thành viên' : 'Thêm đội mới'}
                </button>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="text-center py-10 text-gray-500">Đang tải dữ liệu...</div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[400px]">
                    {activeTab === 'members' ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <tr>
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Họ và tên</th>
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Liên hệ</th>
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Vai trò</th>
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Thuộc Đội</th>
                                        <th className="text-right px-6 py-3 font-medium text-gray-500">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {members.filter(m => m.full_name.toLowerCase().includes(searchTerm.toLowerCase())).map((member) => (
                                        <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200">
                                                {member.full_name}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500">
                                                {member.phone ? (
                                                    <div className="flex items-center gap-2">
                                                        <Phone size={14} />
                                                        {member.phone}
                                                    </div>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {member.role ? (
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs">
                                                        {member.role}
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                {member.teams ? (
                                                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-2 py-1 rounded w-fit">
                                                        <Users size={14} />
                                                        {/* @ts-ignore - Supabase join returns array or object depending on relationship, handling simple case */}
                                                        {member.teams.name}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 italic">Chưa gán đội</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => handleEditMember(member)} className="text-blue-600 hover:underline">Sửa</button>
                                                    <button onClick={() => handleDeleteMember(member.id)} className="text-red-600 hover:underline">Xóa</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {members.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-10 text-gray-500">Chưa có thành viên nào</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                            {teams.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase())).map(team => (
                                <div key={team.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                            <Users size={20} />
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleEditTeam(team)} className="text-gray-400 hover:text-blue-600 px-2">Sửa</button>
                                            <button onClick={() => handleDeleteTeam(team.id)} className="text-gray-400 hover:text-red-600 px-2">Xóa</button>
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-gray-100 text-lg mb-1">{team.name}</h3>
                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{team.description || 'Chưa có mô tả'}</p>
                                    <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 flex justify-between">
                                        <span>Mã: {team.code || 'N/A'}</span>
                                        {/* Placeholder for member count if we had it joined */}
                                        <span>Ngày tạo: {new Date(team.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <div className="col-span-full text-center py-10 text-gray-500">Chưa có đội nào</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {isTeamModalOpen && (
                <TeamModal
                    isOpen={isTeamModalOpen}
                    onClose={() => setIsTeamModalOpen(false)}
                    initialData={editingTeam}
                    onSuccess={() => {
                        setIsTeamModalOpen(false)
                        fetchData()
                    }}
                />
            )}

            {isMemberModalOpen && (
                <MemberModal
                    isOpen={isMemberModalOpen}
                    onClose={() => setIsMemberModalOpen(false)}
                    initialData={editingMember}
                    onSuccess={() => {
                        setIsMemberModalOpen(false)
                        fetchData()
                    }}
                />
            )}
        </div>
    )
}
