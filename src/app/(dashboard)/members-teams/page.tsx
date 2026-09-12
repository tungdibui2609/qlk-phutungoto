'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Plus, Search, Users, Phone, Shield, Briefcase, Filter, MoreHorizontal, FileSpreadsheet } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import TeamModal from '@/components/construction/TeamModal'
import MemberModal from '@/components/construction/MemberModal'
import { useToast } from '@/components/ui/ToastProvider'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

import { ConstructionTeam, ConstructionMember } from './types'

interface GroupedMember {
    key: string
    full_name: string
    phone: string | null
    role: string | null
    is_active: boolean
    user_id?: string | null
    user?: ConstructionMember['user']
    teams: Array<{
        member_id: string
        team_id: string
        team_name: string
    }>
    primaryMember: ConstructionMember
    memberIds: string[]
}

export default function ConstructionMembersPage() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
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
    const [editingMemberTeamIds, setEditingMemberTeamIds] = useState<string[]>([])

    const isModuleEnabled = () => {
        if (!currentSystem?.modules) return false
        const modules = typeof currentSystem.modules === 'string'
            ? JSON.parse(currentSystem.modules)
            : currentSystem.modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes('member_team_manager')
    }

    useEffect(() => {
        if (currentSystem?.code && isModuleEnabled()) {
            fetchData()
        }
    }, [activeTab, currentSystem?.code, currentSystem?.modules])

    async function fetchData() {
        if (!currentSystem?.code) return
        setLoading(true)
        if (activeTab === 'members') {
            const { data, error } = await (supabase
                .from('construction_members') as any)
                .select('*, teams:team_id(id, name), user:user_id(id, full_name, username, email, employee_code, avatar_url)')
                .eq('system_code', currentSystem.code)
                .order('full_name')

            if (error) {
                if (error.code !== 'PGRST301') {
                    console.error('Fetch members error:', error)
                }
            }
            if (data) setMembers(data)
        } else {
            const { data, error } = await (supabase
                .from('construction_teams') as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .order('name')

            if (error) {
                if (error.code !== 'PGRST301') {
                    console.error('Fetch teams error:', error)
                }
            }
            if (data) setTeams(data)
        }
        setLoading(false)
    }

    // Nhóm thành viên để 1 người chỉ hiển thị 1 dòng trên bảng
    const groupedMembers = useMemo(() => {
        const map = new Map<string, GroupedMember>()

        members.forEach(m => {
            const groupKey = m.user_id
                ? `user_${m.user_id}`
                : `manual_${(m.full_name || '').trim().toLowerCase()}_${m.phone || ''}`

            const teamName = m.teams?.name || (m.team_id ? 'Đội khác' : null)

            if (!map.has(groupKey)) {
                map.set(groupKey, {
                    key: groupKey,
                    full_name: m.full_name,
                    phone: m.phone,
                    role: m.role,
                    is_active: m.is_active,
                    user_id: m.user_id,
                    user: m.user,
                    teams: (teamName && m.team_id) ? [{ member_id: m.id, team_id: m.team_id, team_name: teamName }] : [],
                    primaryMember: m,
                    memberIds: [m.id]
                })
            } else {
                const existing = map.get(groupKey)!
                existing.memberIds.push(m.id)
                if (teamName && m.team_id && !existing.teams.some(t => t.team_id === m.team_id)) {
                    existing.teams.push({
                        member_id: m.id,
                        team_id: m.team_id,
                        team_name: teamName
                    })
                }
                if (!existing.role && m.role) existing.role = m.role
                if (!existing.phone && m.phone) existing.phone = m.phone
            }
        })

        return Array.from(map.values())
    }, [members])

    const filteredGroupedMembers = useMemo(() => {
        const q = searchTerm.toLowerCase().trim()
        if (!q) return groupedMembers

        return groupedMembers.filter(m => {
            const teamNames = m.teams.map(t => t.team_name.toLowerCase()).join(' ')
            return m.full_name.toLowerCase().includes(q) ||
                (m.phone && m.phone.includes(q)) ||
                (m.user?.username && m.user.username.toLowerCase().includes(q)) ||
                (m.user?.email && m.user.email.toLowerCase().includes(q)) ||
                teamNames.includes(q)
        })
    }, [groupedMembers, searchTerm])

    // Handlers for Member
    const handleCreateMember = () => {
        setEditingMember(null)
        setEditingMemberTeamIds([])
        setIsMemberModalOpen(true)
    }

    const handleEditMember = (member: ConstructionMember, teamIds?: string[]) => {
        setEditingMember(member)
        setEditingMemberTeamIds(teamIds || (member.team_id ? [member.team_id] : []))
        setIsMemberModalOpen(true)
    }

    const handleDeleteMember = async (memberIds: string[], name: string) => {
        if (!await showConfirm(`Bạn có chắc muốn xóa thành viên "${name}" khỏi hệ thống?`)) return
        const { error } = await (supabase.from('construction_members') as any).delete().in('id', memberIds)
        if (error) showToast('Lỗi xóa: ' + error.message, 'error')
        else {
            showToast('Đã xóa thành công', 'success')
            setMembers(prev => prev.filter(m => !memberIds.includes(m.id)))
        }
    }

    const [isExporting, setIsExporting] = useState(false)

    const handleExportExcel = async () => {
        if (filteredGroupedMembers.length === 0) {
            showToast('Không có dữ liệu thành viên để xuất Excel', 'error')
            return
        }

        try {
            setIsExporting(true)
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('ThanhVien_ToDoi')

            // Thiết lập cột
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Họ và tên', key: 'full_name', width: 26 },
                { header: 'Mã NV', key: 'employee_code', width: 14 },
                { header: 'Tài khoản đăng nhập', key: 'account_name', width: 24 },
                { header: 'Username', key: 'username', width: 16 },
                { header: 'Số lượng đội', key: 'team_count', width: 14 },
                { header: 'Tổ đội trực thuộc', key: 'team_names', width: 36 },
                { header: 'Số điện thoại', key: 'phone', width: 16 },
                { header: 'Vai trò / Chức vụ', key: 'role', width: 22 },
                { header: 'Trạng thái', key: 'status', width: 18 }
            ]

            // Tiêu đề
            worksheet.spliceRows(1, 0,
                [`DANH SÁCH THÀNH VIÊN VÀ PHÂN BỔ TỔ ĐỘI`],
                [`Hệ thống / Kho: ${currentSystem?.name || currentSystem?.code || ''} | Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`],
                []
            )

            worksheet.mergeCells('A1:J1')
            worksheet.mergeCells('A2:J2')

            const titleCell = worksheet.getCell('A1')
            titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E3A8A' } }
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

            const subTitleCell = worksheet.getCell('A2')
            subTitleCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF6B7280' } }
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' }

            worksheet.getRow(1).height = 28
            worksheet.getRow(2).height = 20
            worksheet.getRow(3).height = 10

            // Header row (dòng 4)
            const headerRow = worksheet.getRow(4)
            headerRow.height = 26
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E40AF' } // Blue-800
                }
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF93C5FD' } },
                    bottom: { style: 'thin', color: { argb: 'FF93C5FD' } },
                    left: { style: 'thin', color: { argb: 'FF93C5FD' } },
                    right: { style: 'thin', color: { argb: 'FF93C5FD' } }
                }
            })

            // Data rows
            filteredGroupedMembers.forEach((item, index) => {
                const teamNames = item.teams.map(t => t.team_name).join(', ') || 'Chưa gán đội'
                const row = worksheet.addRow({
                    stt: index + 1,
                    full_name: item.full_name,
                    employee_code: item.user?.employee_code || '',
                    account_name: item.user ? item.user.full_name : 'Chưa liên kết',
                    username: item.user?.username ? `@${item.user.username}` : '',
                    team_count: item.teams.length,
                    team_names: teamNames,
                    phone: item.phone || '',
                    role: item.role || '',
                    status: item.is_active ? 'Đang hoạt động' : 'Tạm ngừng'
                })

                row.height = 22
                row.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Arial', size: 10 }
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    }

                    if (colNumber === 1 || colNumber === 3 || colNumber === 6 || colNumber === 8 || colNumber === 10) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' }
                    }

                    if (index % 2 === 1) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF9FAFB' }
                        }
                    }
                })
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const systemCode = (currentSystem?.code || 'he_thong').toLowerCase()
            const dateStr = new Date().toISOString().split('T')[0]
            const fileName = `Danh_sach_thanh_vien_${systemCode}_${dateStr}.xlsx`

            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            let downloaded = false
            try {
                if (typeof saveAs === 'function') {
                    saveAs(blob, fileName)
                    downloaded = true
                }
            } catch (_) {}

            if (!downloaded && typeof window !== 'undefined') {
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = fileName
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
                document.body.removeChild(a)
            }

            showToast('Xuất file Excel thành công', 'success')
        } catch (err: any) {
            console.error('Lỗi xuất Excel:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        } finally {
            setIsExporting(false)
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

    if (!isModuleEnabled()) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 text-stone-900 dark:text-stone-100">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Users size={40} className="text-stone-400" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                    Cấp quyền tính năng
                </h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng "Thành viên & Đội" chưa được kích hoạt cho kho này.
                    Vui lòng vào Cài đặt {'>'} Tiện ích hệ thống để bật.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Thành viên & Đội</h2>
                    <p className="text-sm text-gray-500">Quản lý nhân sự và phân đội cho các hoạt động vận hành ({currentSystem?.name || '...'})</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('members')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'members'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        Thành viên
                    </button>
                    <button
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'teams'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        Đội thi công
                    </button>
                </div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder={activeTab === 'members' ? "Tìm theo tên, SĐT, tên đội..." : "Tìm tên đội..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'members' && (
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExporting || filteredGroupedMembers.length === 0}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                            title="Xuất danh sách thành viên ra file Excel"
                        >
                            <FileSpreadsheet size={16} />
                            <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
                        </button>
                    )}
                    <button
                        onClick={activeTab === 'members' ? handleCreateMember : handleCreateTeam}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
                    >
                        <Plus size={16} />
                        {activeTab === 'members' ? 'Thêm thành viên' : 'Thêm đội mới'}
                    </button>
                </div>
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
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Tài khoản đăng nhập</th>
                                        <th className="text-left px-6 py-3 font-medium text-gray-500">Thuộc Đội</th>
                                        <th className="text-right px-6 py-3 font-medium text-gray-500">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredGroupedMembers.map((item) => (
                                        <tr key={item.key} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200">
                                                {item.full_name}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.user ? (
                                                    <div className="flex items-center gap-1.5 text-xs text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 rounded-lg w-fit">
                                                        <Shield size={13} className="text-emerald-600 flex-shrink-0" />
                                                        <span className="font-semibold">{item.user.full_name}</span>
                                                        {item.user.username && (
                                                            <span className="text-[10px] text-emerald-600/70 font-mono">(@{item.user.username})</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Chưa liên kết</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.teams.length === 0 ? (
                                                    <span className="text-gray-400 italic text-xs">Chưa gán đội</span>
                                                ) : item.teams.length === 1 ? (
                                                    <div className="flex items-center gap-1.5 text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-semibold w-fit">
                                                        <Users size={13} className="text-blue-600 flex-shrink-0" />
                                                        <span>{item.teams[0].team_name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="text-xs font-extrabold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                                                            <Users size={12} className="text-blue-600" />
                                                            {item.teams.length} đội
                                                        </span>
                                                        {item.teams.map(t => (
                                                            <span key={t.team_id} className="inline-flex items-center text-xs font-medium text-stone-700 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-md">
                                                                👥 {t.team_name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-3 text-xs font-semibold">
                                                    <button
                                                        onClick={() => handleEditMember(item.primaryMember, item.teams.map(t => t.team_id))}
                                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMember(item.memberIds, item.full_name)}
                                                        className="text-red-600 hover:text-red-800 hover:underline"
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredGroupedMembers.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="text-center py-10 text-gray-500">Chưa có thành viên nào</td>
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
                    initialTeamIds={editingMemberTeamIds}
                    onSuccess={() => {
                        setIsMemberModalOpen(false)
                        fetchData()
                    }}
                />
            )}
        </div>
    )
}
