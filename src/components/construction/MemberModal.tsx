'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { X, Save, UserCheck, Shield, Sparkles, Search, Check, ChevronDown, Users, AlertCircle } from 'lucide-react'
import { ConstructionMember, ConstructionTeam } from '@/app/(dashboard)/members-teams/types'
import { normalizeSearchString } from '@/lib/searchUtils'

interface Props {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    initialData: ConstructionMember | null
    initialTeamIds?: string[]
}

interface SystemUserOption {
    id: string
    full_name: string
    username: string | null
    email: string | null
    phone: string | null
    employee_code: string | null
    avatar_url?: string | null
}

interface UserTeamLink {
    teamId: string | null
    teamName: string
}

export default function MemberModal({ isOpen, onClose, onSuccess, initialData, initialTeamIds }: Props) {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [teams, setTeams] = useState<ConstructionTeam[]>([])
    const [systemUsers, setSystemUsers] = useState<SystemUserOption[]>([])
    const [userTeamsMap, setUserTeamsMap] = useState<Record<string, UserTeamLink[]>>({})
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])

    // Dropdown state for user selection
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
    const [userSearchQuery, setUserSearchQuery] = useState('')
    const [userFilterTab, setUserFilterTab] = useState<'all' | 'unassigned' | 'assigned'>('all')
    const dropdownRef = useRef<HTMLDivElement>(null)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const [formData, setFormData] = useState({
        full_name: initialData?.full_name || '',
        phone: initialData?.phone || '',
        role: initialData?.role || '',
        team_id: initialData?.team_id || '',
        user_id: initialData?.user_id || '',
        is_active: initialData?.is_active ?? true
    })

    useEffect(() => {
        if (isOpen) {
            setFormData({
                full_name: initialData?.full_name || '',
                phone: initialData?.phone || '',
                role: initialData?.role || '',
                team_id: initialData?.team_id || '',
                user_id: initialData?.user_id || '',
                is_active: initialData?.is_active ?? true
            })
            const startingTeamIds = initialTeamIds && initialTeamIds.length > 0
                ? initialTeamIds
                : (initialData?.team_id ? [initialData.team_id] : [])
            setSelectedTeamIds(startingTeamIds)
            setIsUserDropdownOpen(false)
            setUserSearchQuery('')
            setUserFilterTab('all')

            if (currentSystem?.code) {
                fetchTeams()
                fetchSystemUsers()
                fetchUserTeams()
            }
        }
    }, [isOpen, initialData, initialTeamIds, currentSystem?.code])

    // Handle click outside to close user dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsUserDropdownOpen(false)
            }
        }
        if (isUserDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            setTimeout(() => {
                searchInputRef.current?.focus()
            }, 50)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isUserDropdownOpen])

    async function fetchTeams() {
        if (!currentSystem?.code) return
        try {
            const { data } = await (supabase.from('construction_teams') as any)
                .select('id, name')
                .eq('system_code', currentSystem.code)
                .order('name')
            if (data) setTeams(data)
        } catch (err) {
            console.error('Error fetching teams:', err)
        }
    }

    async function fetchSystemUsers() {
        try {
            const companyId = currentSystem?.company_id || profile?.company_id
            let query = supabase
                .from('user_profiles')
                .select('id, full_name, username, email, phone, employee_code, avatar_url')
                .eq('is_active', true)

            if (companyId) {
                query = query.eq('company_id', companyId)
            }

            const { data } = await query.order('full_name')
            if (data) setSystemUsers(data as any)
        } catch (err) {
            console.error('Error fetching system users for member link:', err)
        }
    }

    async function fetchUserTeams() {
        if (!currentSystem?.code) return
        try {
            const { data } = await (supabase.from('construction_members') as any)
                .select('id, user_id, team_id, teams:team_id(id, name)')
                .eq('system_code', currentSystem.code)
                .not('user_id', 'is', null)

            if (data) {
                const map: Record<string, UserTeamLink[]> = {}
                data.forEach((m: any) => {
                    if (!m.user_id) return
                    if (!map[m.user_id]) map[m.user_id] = []
                    const tName = m.teams?.name || (m.team_id ? 'Đội khác' : 'Chưa gán đội')
                    if (!map[m.user_id].some(t => t.teamName === tName)) {
                        map[m.user_id].push({
                            teamId: m.team_id,
                            teamName: tName
                        })
                    }
                })
                setUserTeamsMap(map)
            }
        } catch (err) {
            console.error('Error fetching user teams:', err)
        }
    }

    const handleUserSelect = (selectedUserId: string) => {
        const u = systemUsers.find(user => user.id === selectedUserId)
        setFormData(prev => ({
            ...prev,
            user_id: selectedUserId,
            // Auto fill full_name if currently empty
            full_name: (!prev.full_name || prev.full_name.trim() === '') && u ? u.full_name : prev.full_name,
            // Auto fill phone if currently empty
            phone: (!prev.phone || prev.phone.trim() === '') && u?.phone ? u.phone : prev.phone
        }))
        setIsUserDropdownOpen(false)
        setUserSearchQuery('')
    }

    const toggleTeamSelection = (teamId: string) => {
        setSelectedTeamIds(prev => {
            if (prev.includes(teamId)) {
                return prev.filter(id => id !== teamId)
            } else {
                return [...prev, teamId]
            }
        })
    }

    const selectAllTeams = () => {
        setSelectedTeamIds(teams.map(t => t.id))
    }

    const clearAllTeams = () => {
        setSelectedTeamIds([])
    }

    // Selected user details and team membership
    const selectedUser = useMemo(() => {
        return systemUsers.find(u => u.id === formData.user_id)
    }, [systemUsers, formData.user_id])

    const selectedUserTeams = useMemo(() => {
        if (!formData.user_id) return []
        return userTeamsMap[formData.user_id] || []
    }, [formData.user_id, userTeamsMap])

    // Filtered users for dropdown
    const filteredUsers = useMemo(() => {
        return systemUsers.filter(u => {
            const userTeams = userTeamsMap[u.id] || []
            const isAssigned = userTeams.length > 0

            // Filter tab
            if (userFilterTab === 'unassigned' && isAssigned) return false
            if (userFilterTab === 'assigned' && !isAssigned) return false

            // Search query
            if (!userSearchQuery.trim()) return true
            const q = normalizeSearchString(userSearchQuery, true)
            const teamNames = userTeams.map(t => t.teamName).join(' ')
            const searchableText = `${u.full_name} ${u.employee_code || ''} ${u.username || ''} ${u.email || ''} ${teamNames}`
            return normalizeSearchString(searchableText, true).includes(q)
        })
    }, [systemUsers, userTeamsMap, userFilterTab, userSearchQuery])

    const unassignedCount = useMemo(() => {
        return systemUsers.filter(u => !(userTeamsMap[u.id] && userTeamsMap[u.id].length > 0)).length
    }, [systemUsers, userTeamsMap])

    const assignedCount = useMemo(() => {
        return systemUsers.filter(u => userTeamsMap[u.id] && userTeamsMap[u.id].length > 0).length
    }, [systemUsers, userTeamsMap])

    const isAlreadyInSelectedTeam = useMemo(() => {
        if (selectedTeamIds.length === 0 || !formData.user_id) return false
        return selectedTeamIds.some(tid => {
            if (initialData && initialData.user_id === formData.user_id && initialData.team_id === tid) {
                return false
            }
            return selectedUserTeams.some(t => t.teamId === tid)
        })
    }, [selectedTeamIds, formData.user_id, selectedUserTeams, initialData])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            let companyId = profile?.company_id

            if (!companyId) {
                const { data: userData } = await supabase
                    .from('user_profiles')
                    .select('company_id')
                    .single()
                if (userData) companyId = userData.company_id
            }

            const basePayload = {
                full_name: formData.full_name.trim(),
                phone: formData.phone?.trim() || null,
                role: formData.role?.trim() || null,
                user_id: formData.user_id || null,
                is_active: formData.is_active,
                updated_at: new Date().toISOString()
            }

            if (initialData) {
                // Update mode
                // 1. Cập nhật bản ghi hiện tại: giữ lại team_id cũ nếu vẫn được chọn, hoặc lấy đội đầu tiên
                const primaryTeamId = selectedTeamIds.includes(initialData.team_id || '')
                    ? initialData.team_id
                    : (selectedTeamIds.length > 0 ? selectedTeamIds[0] : null)

                const { error: updateErr } = await (supabase.from('construction_members') as any)
                    .update({
                        ...basePayload,
                        team_id: primaryTeamId
                    })
                    .eq('id', initialData.id)

                if (updateErr) throw updateErr

                // 2. Gỡ bỏ các đội cũ bị bỏ tick (nếu có)
                if (initialTeamIds && initialTeamIds.length > 0) {
                    const removedTeamIds = initialTeamIds.filter(tid => !selectedTeamIds.includes(tid))
                    if (removedTeamIds.length > 0 && formData.user_id) {
                        await (supabase.from('construction_members') as any)
                            .delete()
                            .eq('user_id', formData.user_id)
                            .eq('system_code', currentSystem?.code)
                            .in('team_id', removedTeamIds)
                    }
                }

                // 3. Thêm các đội mới khác (nếu người dùng tick thêm các đội chưa có)
                const otherTeamIds = selectedTeamIds.filter(tid => tid !== primaryTeamId)
                const existingUserTeamIds = (formData.user_id ? userTeamsMap[formData.user_id] || [] : [])
                    .map(t => t.teamId)
                    .filter(Boolean)

                const newTeamsToInsert = otherTeamIds.filter(tid => !existingUserTeamIds.includes(tid))

                if (newTeamsToInsert.length > 0) {
                    const insertPayloads = newTeamsToInsert.map(tid => ({
                        ...basePayload,
                        team_id: tid,
                        company_id: companyId,
                        system_code: currentSystem?.code,
                        created_by: profile?.id
                    }))

                    const { error: insertErr } = await (supabase.from('construction_members') as any)
                        .insert(insertPayloads)

                    if (insertErr) throw insertErr
                }

                // 4. Đồng bộ họ tên, SĐT, vai trò sang tất cả bản ghi còn lại của tài khoản này
                if (formData.user_id) {
                    await (supabase.from('construction_members') as any)
                        .update({
                            full_name: basePayload.full_name,
                            phone: basePayload.phone,
                            role: basePayload.role,
                            is_active: basePayload.is_active,
                            updated_at: basePayload.updated_at
                        })
                        .eq('user_id', formData.user_id)
                        .eq('system_code', currentSystem?.code)
                }

                showToast('Cập nhật thông tin và tổ đội thành công', 'success')
            } else {
                // Create mode
                if (selectedTeamIds.length <= 1) {
                    const singleTeamId = selectedTeamIds.length === 1 ? selectedTeamIds[0] : null
                    const { error } = await (supabase.from('construction_members') as any)
                        .insert({
                            ...basePayload,
                            team_id: singleTeamId,
                            company_id: companyId,
                            system_code: currentSystem?.code,
                            created_by: profile?.id
                        })

                    if (error) throw error
                    showToast('Thêm thành viên mới thành công', 'success')
                } else {
                    // Chọn nhiều đội cùng lúc: tạo bản ghi cho từng đội
                    const insertPayloads = selectedTeamIds.map(tid => ({
                        ...basePayload,
                        team_id: tid,
                        company_id: companyId,
                        system_code: currentSystem?.code,
                        created_by: profile?.id
                    }))

                    const { error } = await (supabase.from('construction_members') as any)
                        .insert(insertPayloads)

                    if (error) throw error
                    showToast(`Đã thêm thành viên vào ${selectedTeamIds.length} tổ đội cùng lúc thành công!`, 'success')
                }
            }
            onSuccess()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-stone-200">
                <div className="flex justify-between items-center p-4 border-b border-stone-100 bg-stone-50">
                    <div>
                        <h3 className="font-extrabold text-stone-900 text-base">
                            {initialData ? 'Cập nhật Thành viên' : 'Thêm Thành viên Mới'}
                        </h3>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Quản lý nhân sự đội và liên kết tài khoản hệ thống
                        </p>
                    </div>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-200/60 transition">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* 1. LIÊN KẾT TÀI KHOẢN ĐĂNG NHẬP */}
                    <div className="p-3.5 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200 rounded-2xl space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                                <UserCheck className="w-4 h-4 text-blue-600" />
                                <span>Liên kết tài khoản đăng nhập</span>
                            </label>
                            {formData.user_id ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    <Shield className="w-3 h-3 text-emerald-600" />
                                    Đã liên kết
                                </span>
                            ) : (
                                <span className="text-[10px] text-stone-400 font-medium italic">
                                    Chưa liên kết
                                </span>
                            )}
                        </div>

                        {/* CUSTOM SEARCHABLE SELECTOR */}
                        <div className="relative" ref={dropdownRef}>
                            {/* Trigger Box */}
                            <div
                                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                className={`w-full p-2.5 border rounded-xl bg-white cursor-pointer shadow-sm transition-all ${
                                    isUserDropdownOpen
                                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                                        : 'border-blue-200 hover:border-blue-300'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    {selectedUser ? (
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                                                    {selectedUser.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                                </div>
                                                <span className="font-bold text-stone-800 text-xs truncate">
                                                    {selectedUser.full_name}
                                                </span>
                                                {selectedUser.employee_code && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                                        {selectedUser.employee_code}
                                                    </span>
                                                )}
                                                {selectedUser.username && (
                                                    <span className="text-[11px] text-stone-400 truncate">
                                                        @{selectedUser.username}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Danh sách các đội đã tham gia */}
                                            <div className="mt-1 flex flex-wrap items-center gap-1 pl-8">
                                                {selectedUserTeams.length > 0 ? (
                                                    <>
                                                        <span className="text-[10px] text-stone-500 font-medium">
                                                            Đã trong {selectedUserTeams.length} đội:
                                                        </span>
                                                        {selectedUserTeams.map(t => (
                                                            <span
                                                                key={t.teamName}
                                                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            >
                                                                <Users size={10} className="text-emerald-600" />
                                                                {t.teamName}
                                                            </span>
                                                        ))}
                                                    </>
                                                ) : (
                                                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 font-medium px-1.5 py-0.5 rounded-md">
                                                        ⚪ Chưa tham gia đội nào
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-stone-500 font-medium">
                                            -- Không liên kết (Thành viên thủ công) --
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {formData.user_id && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleUserSelect('')
                                                }}
                                                className="p-1 text-stone-400 hover:text-red-500 hover:bg-stone-100 rounded-md transition"
                                                title="Hủy liên kết tài khoản"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <ChevronDown
                                            size={16}
                                            className={`text-stone-400 transition-transform duration-200 ${
                                                isUserDropdownOpen ? 'rotate-180 text-blue-600' : ''
                                            }`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Dropdown Menu */}
                            {isUserDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                    {/* Search Input */}
                                    <div className="p-2 border-b border-stone-100 bg-stone-50/70">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                            <input
                                                ref={searchInputRef}
                                                type="text"
                                                value={userSearchQuery}
                                                onChange={e => setUserSearchQuery(e.target.value)}
                                                placeholder="Tìm theo tên, mã NV, username hoặc tên đội..."
                                                className="w-full pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-stone-400 text-stone-800"
                                            />
                                            {userSearchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setUserSearchQuery('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Filter Tabs */}
                                        <div className="flex items-center gap-1 mt-2">
                                            <button
                                                type="button"
                                                onClick={() => setUserFilterTab('all')}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                                                    userFilterTab === 'all'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
                                                }`}
                                            >
                                                Tất cả ({systemUsers.length})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setUserFilterTab('unassigned')}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                                                    userFilterTab === 'unassigned'
                                                        ? 'bg-amber-600 text-white shadow-xs'
                                                        : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
                                                }`}
                                            >
                                                Chưa vào đội ({unassignedCount})
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setUserFilterTab('assigned')}
                                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
                                                    userFilterTab === 'assigned'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'bg-white text-stone-600 hover:bg-stone-200/70 border border-stone-200'
                                                }`}
                                            >
                                                Đã vào đội ({assignedCount})
                                            </button>
                                        </div>
                                    </div>

                                    {/* Users List */}
                                    <div className="max-h-60 overflow-y-auto divide-y divide-stone-100">
                                        {/* Option: Không liên kết */}
                                        <button
                                            type="button"
                                            onClick={() => handleUserSelect('')}
                                            className={`w-full text-left px-3 py-2.5 hover:bg-blue-50/60 transition flex items-center justify-between text-xs ${
                                                !formData.user_id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-stone-600 font-medium'
                                            }`}
                                        >
                                            <span>-- Không liên kết (Thành viên thủ công) --</span>
                                            {!formData.user_id && <Check size={14} className="text-blue-600" />}
                                        </button>

                                        {filteredUsers.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-stone-400 italic">
                                                Không tìm thấy tài khoản phù hợp
                                            </div>
                                        ) : (
                                            filteredUsers.map(u => {
                                                const uTeams = userTeamsMap[u.id] || []
                                                const isSelected = formData.user_id === u.id
                                                const isInCurrentFormTeam = formData.team_id && uTeams.some(t => t.teamId === formData.team_id)

                                                return (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => handleUserSelect(u.id)}
                                                        className={`w-full text-left p-2.5 hover:bg-blue-50/60 transition flex items-start justify-between gap-2 ${
                                                            isSelected ? 'bg-blue-50/80 ring-1 ring-blue-500/20' : ''
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                            <div className="w-7 h-7 rounded-full bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5 border border-stone-200">
                                                                {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                                                            </div>

                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-1.5">
                                                                    <span className="font-bold text-stone-800 text-xs">
                                                                        {u.full_name}
                                                                    </span>
                                                                    {u.employee_code && (
                                                                        <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                                                            {u.employee_code}
                                                                        </span>
                                                                    )}
                                                                    {u.username && (
                                                                        <span className="text-[11px] text-stone-400 font-mono">
                                                                            @{u.username}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {u.email && !u.email.endsWith('.local') && !u.email.includes('@system.local') && (
                                                                    <p className="text-[11px] text-stone-400 truncate">
                                                                        {u.email}
                                                                    </p>
                                                                )}

                                                                {/* Tổ đội liên kết */}
                                                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                                    {uTeams.length > 0 ? (
                                                                        <>
                                                                            <span className="text-[10px] text-stone-500 font-medium">
                                                                                Đã trong {uTeams.length} đội:
                                                                            </span>
                                                                            {uTeams.map(t => (
                                                                                <span
                                                                                    key={t.teamName}
                                                                                    className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                                >
                                                                                    <Users size={10} className="text-emerald-600" />
                                                                                    {t.teamName}
                                                                                </span>
                                                                            ))}
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-[10px] text-stone-500 bg-stone-100 border border-stone-200 font-medium px-1.5 py-0.5 rounded">
                                                                            ⚪ Chưa vào đội nào
                                                                        </span>
                                                                    )}

                                                                    {isInCurrentFormTeam && (
                                                                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                            <AlertCircle size={10} className="text-amber-600" />
                                                                            Đã có trong đội này
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {isSelected && (
                                                            <div className="flex-shrink-0 mt-1">
                                                                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                                                                    <Check size={12} strokeWidth={3} />
                                                                </span>
                                                            </div>
                                                        )}
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Cảnh báo nếu tài khoản này đã có trong đội đang chọn */}
                        {isAlreadyInSelectedTeam && (
                            <div className="flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <span>
                                    <strong>Lưu ý:</strong> Tài khoản này hiện đã có trong đội được chọn. Nếu bạn tiếp tục lưu, tài khoản sẽ có thêm một vị trí thành viên mới trong đội.
                                </span>
                            </div>
                        )}

                        <p className="text-[11px] text-blue-700/80 leading-relaxed flex items-start gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <span>
                                Khi liên kết, tài khoản này sẽ tự nhận diện đúng Đội phân công khi giao việc,
                                nhận thông báo ca trực và trực tiếp bấm xác nhận tiếp nhận trên hệ thống.
                            </span>
                        </p>
                    </div>

                    {/* 2. HỌ VÀ TÊN */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                            Họ và tên thành viên <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            value={formData.full_name}
                            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="VD: Nguyễn Văn A"
                        />
                    </div>

                    {/* 3. SỐ ĐIỆN THOẠI & VAI TRÒ */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1">Số điện thoại</label>
                            <input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="09xxxxxxx"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1">Chức vụ / Vai trò</label>
                            <input
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="VD: Đội trưởng, Thợ chính..."
                            />
                        </div>
                    </div>

                    {/* 4. THUỘC TỔ ĐỘI (CHỌN NHIỀU ĐỘI) */}
                    <div className="space-y-2.5 p-3.5 bg-stone-50/80 border border-stone-200 rounded-2xl">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-blue-600" />
                                <span>Thuộc Tổ Đội</span>
                                <span className="text-[11px] font-normal text-stone-400">
                                    (Chọn một hoặc nhiều đội)
                                </span>
                            </label>

                            <div>
                                {selectedTeamIds.length > 0 ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                        Đã chọn {selectedTeamIds.length} đội
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-stone-400 font-medium italic">
                                        Chưa gán đội
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Thao tác chọn nhanh */}
                        {teams.length > 2 && (
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                                <span className="text-stone-400 text-[10px]">Tick chọn các đội muốn phân công:</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllTeams}
                                        className="text-blue-600 hover:text-blue-700 font-semibold text-[11px]"
                                    >
                                        Chọn tất cả ({teams.length})
                                    </button>
                                    <span className="text-stone-300">•</span>
                                    <button
                                        type="button"
                                        onClick={clearAllTeams}
                                        className="text-stone-500 hover:text-stone-700 font-semibold text-[11px]"
                                    >
                                        Bỏ chọn hết
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Danh sách các đội */}
                        {teams.length === 0 ? (
                            <p className="text-xs text-stone-400 italic py-2">
                                Chưa có tổ đội nào trong hệ thống này.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                                {teams.map(t => {
                                    const isSelected = selectedTeamIds.includes(t.id)
                                    const isAlreadyInTeam = formData.user_id && (userTeamsMap[formData.user_id] || []).some(
                                        ut => ut.teamId === t.id && (!initialData || ut.teamId !== initialData.team_id)
                                    )

                                    return (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => toggleTeamSelection(t.id)}
                                            className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all ${
                                                isSelected
                                                    ? 'bg-blue-50/80 border-blue-500 ring-1 ring-blue-500/20 text-blue-900 shadow-xs font-semibold'
                                                    : 'bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50/80 text-stone-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                                                    isSelected
                                                        ? 'bg-blue-600 border-blue-600 text-white'
                                                        : 'border-stone-300 bg-white'
                                                }`}>
                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs truncate">
                                                        👥 {t.name}
                                                    </p>
                                                    {isAlreadyInTeam && (
                                                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 inline-block mt-0.5">
                                                            ✓ Đã tham gia trước đó
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        <p className="text-[11px] text-stone-500 pt-0.5">
                            {selectedTeamIds.length > 1 ? (
                                <span className="text-blue-700 font-semibold">
                                    💡 Hệ thống sẽ tự động tạo vị trí thành viên cho tài khoản này ở cả {selectedTeamIds.length} tổ đội đã chọn.
                                </span>
                            ) : selectedTeamIds.length === 1 ? (
                                <span>Thành viên sẽ được gán vào 1 tổ đội đã chọn.</span>
                            ) : (
                                <span>Không chọn đội nào: Thành viên sẽ ở trạng thái tự do (chưa phân đội).</span>
                            )}
                        </p>
                    </div>

                    {/* 5. TRẠNG THÁI HOẠT ĐỘNG */}
                    {initialData && (
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={formData.is_active}
                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500"
                            />
                            <label htmlFor="is_active" className="text-xs font-semibold text-stone-700 cursor-pointer">
                                Đang hoạt động
                            </label>
                        </div>
                    )}

                    {/* ACTIONS */}
                    <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 text-xs font-semibold hover:bg-stone-50 transition"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-blue-500/25 disabled:opacity-50 transition"
                        >
                            <Save size={14} />
                            <span>{loading ? 'Đang lưu...' : 'Lưu lại'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
