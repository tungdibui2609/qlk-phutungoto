'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
    LayoutGrid,
    Search,
    RefreshCw,
    Plus,
    Bell,
    Check,
    Clock,
    AlertTriangle,
    Flame,
    Users,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Pencil,
    Trash2,
    Image as ImageIcon,
    CheckCircle2,
    Monitor,
    ShieldCheck,
    UserCheck,
    X,
    Filter,
    ArrowUpDown,
    Send,
    TrendingUp
} from 'lucide-react'
import { ShiftTask, TaskStatus } from './types'
import { 
    formatDateTime, 
    formatDateRelative, 
    hasUserAcknowledged, 
    isTaskAssignedToTeam,
    getAssignedTeams,
    getTeamCompletions,
    isTeamCompleted,
    isTeamAcknowledged,
    getTaskTeamProgress,
    canUserCompleteTeamTask,
    canUserAcknowledgeTask,
    getTaskType,
    canManageTask,
    getTeamMemberAckInfo,
    getDeduplicatedAcknowledgements
} from './taskUtils'
import { formatTaskContentPreview, getCardContentPreview, extractInlineImageUrls } from './taskContentUtils'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type TeamCardStage = 'latest' | 'waiting_ack' | 'acknowledged' | 'completed'

interface MobileShiftTasksViewProps {
    tasks: ShiftTask[]
    teams: { id: string; name: string }[]
    myTeamIds: string[]
    allMembers: { id: string; team_id: string | null; user_id: string | null; full_name: string | null }[]
    loading: boolean
    refreshing: boolean
    onRefresh: () => void
    onCreateTask: (targetShift?: string) => void
    onSelectTask: (task: ShiftTask) => void
    onQuickAcknowledge: (e: React.MouseEvent, task: ShiftTask) => void
    onQuickDelete: (e: React.MouseEvent, task: ShiftTask) => void
    onOpenCompleteModal: (task: ShiftTask) => void
    onOpenEditModal: (task: ShiftTask) => void
    onImageClick: (images: string[], index: number) => void
    currentSystem: any
    profile: any
    isSanxuat?: boolean
    onSwitchToDesktop?: () => void
}

export default function MobileShiftTasksView({
    tasks,
    teams,
    myTeamIds,
    allMembers,
    loading,
    refreshing,
    onRefresh,
    onCreateTask,
    onSelectTask,
    onQuickAcknowledge,
    onQuickDelete,
    onOpenCompleteModal,
    onOpenEditModal,
    onImageClick,
    currentSystem,
    profile,
    isSanxuat = false,
    onSwitchToDesktop,
}: MobileShiftTasksViewProps) {
    // Mobile View Tab: 'teams' | 'my_tasks' | 'unack' | 'pending' | 'in_progress' | 'completed' | 'all'
    const [activeTab, setActiveTab] = useState<string>('teams')
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearch, setShowSearch] = useState(false)
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null)

    // Stage map cho từng thẻ đội trên mobile ('latest' | 'waiting_ack' | 'acknowledged' | 'completed')
    const [cardStageMap, setCardStageMap] = useState<Record<string, TeamCardStage>>({})
    const getTeamStage = (teamId: string): TeamCardStage => cardStageMap[teamId] || 'latest'
    const setTeamStage = (teamId: string, stage: TeamCardStage) => setCardStageMap(prev => ({ ...prev, [teamId]: stage }))

    // My teams names
    const myTeamNames = useMemo(() => {
        return teams
            .filter(t => myTeamIds.includes(t.id))
            .map(t => t.name.toLowerCase().trim())
    }, [teams, myTeamIds])

    const rawMyTeamNames = useMemo(() => {
        return teams
            .filter(t => myTeamIds.includes(t.id))
            .map(t => t.name)
    }, [teams, myTeamIds])

    // Total unacknowledged tasks for the current logged-in user:
    // Only tasks assigned to this user or user's teams that haven't been acknowledged yet.
    // Tasks created by this user for other teams are NOT counted here!
    const unackTasksForMe = useMemo(() => {
        return tasks.filter(t => 
            t.status !== 'completed' &&
            !hasUserAcknowledged(t, profile?.id, profile?.full_name) &&
            canUserAcknowledgeTask(t, profile, rawMyTeamNames, allMembers, teams)
        )
    }, [tasks, profile, rawMyTeamNames, allMembers, teams])

    // Tasks created by the current logged-in user (Công việc / Lời nhắc đã giao)
    const myCreatedTasks = useMemo(() => {
        return tasks.filter(t => 
            (profile?.id && t.created_by && profile.id === t.created_by) ||
            (profile?.full_name && t.created_by_name && profile.full_name.trim().toLowerCase() === t.created_by_name.trim().toLowerCase())
        )
    }, [tasks, profile?.id, profile?.full_name])

    const inProgressCount = useMemo(() => tasks.filter(t => t.status === 'in_progress').length, [tasks])
    const completedCount = useMemo(() => tasks.filter(t => t.status === 'completed').length, [tasks])
    const myTasksCount = useMemo(() => {
        return tasks.filter(t => {
            const isForMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(t, name))
            const isAssignedToMe = t.assigned_to === profile?.id
            const isCreatedByMe = t.created_by === profile?.id
            return isForMyTeam || isAssignedToMe || isCreatedByMe
        }).length
    }, [tasks, myTeamNames, profile?.id])

    // State mở Menu danh mục & bộ lọc dạng Bottom Sheet
    const [showMenuSheet, setShowMenuSheet] = useState(false)

    // Push Notifications & App Badge Manager
    const {
        isSupported: isPushSupported,
        permission: pushPermission,
        isSubscribed: isPushSubscribed,
        subscription: pushSubscription,
        getSubscription: getPushSubscription,
        loading: pushLoading,
        subscribe: subscribePush,
        updateAppBadge,
    } = usePushNotifications({
        userId: profile?.id,
        userName: profile?.full_name,
        teamNames: rawMyTeamNames,
        systemCode: currentSystem?.code,
        companyId: currentSystem?.company_id || profile?.company_id,
    })

    const [testingPush, setTestingPush] = useState(false)

    const handleTestPush = async () => {
        setTestingPush(true)
        try {
            const currentSub = pushSubscription || (getPushSubscription ? await getPushSubscription() : null)
            const res = await fetch('/api/notifications/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: '🔔 Thử Chuông Báo Chánh Thu',
                    body: 'Điện thoại của bạn đã kết nối thành công và sẵn sàng nhận thông báo việc mới!',
                    target_shifts: rawMyTeamNames,
                    user_id: profile?.id,
                    user_name: profile?.full_name,
                    subscription: currentSub ? currentSub.toJSON() : undefined,
                    is_test: true,
                    url: '/work/tasks',
                    badgeCount: unackTasksForMe.length || 1,
                }),
            })
            const data = await res.json()
            if (data.sentCount > 0) {
                alert('🔔 Đã gửi chuông test thành công! Bạn hãy khóa màn hình hoặc kéo thanh thông báo điện thoại xuống để xem nhé.')
            } else {
                alert(data.message || 'Chưa tìm thấy thiết bị nào đã đăng ký. Bạn hãy chắc chắn đã bấm Bật ngay và chọn Cho phép trên điện thoại nhé!')
            }
        } catch (e: any) {
            alert('Lỗi khi gửi test: ' + e.message)
        } finally {
            setTestingPush(false)
        }
    }

    // Automatically synchronize App Badge (red dot / counter on phone icon)
    React.useEffect(() => {
        updateAppBadge(unackTasksForMe.length)
    }, [unackTasksForMe.length, updateAppBadge])

    // Team items computation for overview
    const teamItems = useMemo(() => {
        return teams.map(team => {
            const teamNameLower = team.name.toLowerCase().trim()
            const isMyTeam = myTeamIds.includes(team.id)

            // Tasks assigned to this team
            const teamTasks = tasks.filter(t => isTaskAssignedToTeam(t, teamNameLower))
            const total = teamTasks.length

            // Unacknowledged by current user
            const unackTasks = teamTasks.filter(
                t => t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
            )

            // Tasks not acknowledged by ANY member of this team
            const teamMembers = allMembers.filter(m => m.team_id === team.id)
            const teamMemberUserIds = new Set(teamMembers.map(m => m.user_id).filter(Boolean))
            const teamMemberNames = new Set(teamMembers.map(m => m.full_name?.trim().toLowerCase()).filter(Boolean))

            const teamUnackTasks = teamTasks.filter(t => {
                if (t.status === 'completed') return false
                const acks: any[] = Array.isArray(t.acknowledgements) && t.acknowledgements.length > 0
                    ? t.acknowledgements
                    : (t.acknowledged_by_name ? [{ user_id: t.acknowledged_by, user_name: t.acknowledged_by_name }] : [])
                if (acks.length === 0) return true
                return !acks.some(a => 
                    (a.user_id && teamMemberUserIds.has(a.user_id)) ||
                    (a.user_name && teamMemberNames.has(a.user_name.trim().toLowerCase()))
                )
            })

            // Acknowledged (in_progress or acknowledged by user/team, but not completed)
            const acknowledgedTasks = teamTasks.filter(t => {
                if (t.status === 'completed') return false
                if (isMyTeam) {
                    return hasUserAcknowledged(t, profile?.id, profile?.full_name) || t.status === 'in_progress'
                } else {
                    const acks: any[] = Array.isArray(t.acknowledgements) && t.acknowledgements.length > 0
                        ? t.acknowledgements
                        : (t.acknowledged_by_name ? [{ user_id: t.acknowledged_by, user_name: t.acknowledged_by_name }] : [])
                    const ackedByTeam = acks.some(a => 
                        (a.user_id && teamMemberUserIds.has(a.user_id)) ||
                        (a.user_name && teamMemberNames.has(a.user_name.trim().toLowerCase()))
                    )
                    return ackedByTeam || t.status === 'in_progress'
                }
            }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())

            const completedTasksList = teamTasks.filter(t => t.status === 'completed').sort(
                (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
            )

            const latestTasks = [...teamTasks].sort(
                (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            )

            const waitingAckTasks = isMyTeam ? unackTasks : teamUnackTasks

            return {
                team,
                isMyTeam,
                total,
                unackTasks,
                unackCount: unackTasks.length,
                teamUnackCount: teamUnackTasks.length,
                teamUnackTasks,
                waitingAckTasks,
                acknowledgedTasks,
                completedTasksList,
                latestTasks,
                allTeamTasks: teamTasks,
            }
        }).sort((a, b) => {
            // Priority 1: Đội của người dùng luôn lên đầu
            if (a.isMyTeam && !b.isMyTeam) return -1
            if (!a.isMyTeam && b.isMyTeam) return 1

            // Priority 2: Đội có việc chưa nhận lên trước
            if (a.unackCount > 0 && b.unackCount === 0) return -1
            if (a.unackCount === 0 && b.unackCount > 0) return 1

            // Priority 3: Tổng việc nhiều hơn lên trước
            if (b.total !== a.total) return b.total - a.total

            // Priority 4: Tên đội theo bảng chữ cái tiếng Việt
            return a.team.name.localeCompare(b.team.name, 'vi')
        })
    }, [teams, tasks, myTeamIds, allMembers, profile?.id, profile?.full_name])

    // Filtered tasks based on activeTab and search
    const filteredTasks = useMemo(() => {
        let list = tasks

        // Filter by team if a specific team was clicked
        if (selectedTeamFilter) {
            list = list.filter(t => isTaskAssignedToTeam(t, selectedTeamFilter.toLowerCase().trim()))
        }

        // Filter by tab
        if (activeTab === 'my_tasks') {
            list = list.filter(t => {
                const isForMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(t, name))
                const isAssignedToMe = t.assigned_to === profile?.id
                const isCreatedByMe = t.created_by === profile?.id
                return isForMyTeam || isAssignedToMe || isCreatedByMe
            })
        } else if (activeTab === 'unack') {
            list = list.filter(t => 
                t.status !== 'completed' &&
                !hasUserAcknowledged(t, profile?.id, profile?.full_name) &&
                canUserAcknowledgeTask(t, profile, rawMyTeamNames, allMembers, teams)
            )
        } else if (activeTab === 'created_by_me') {
            list = myCreatedTasks
        } else if (activeTab === 'pending') {
            list = list.filter(t => t.status === 'pending')
        } else if (activeTab === 'in_progress') {
            list = list.filter(t => t.status === 'in_progress')
        } else if (activeTab === 'completed') {
            list = list.filter(t => t.status === 'completed')
        }

        // Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            list = list.filter(t => {
                const matchCode = (t.code || '').toLowerCase().includes(q)
                const matchTitle = (t.title || '').toLowerCase().includes(q)
                const matchContent = (t.content || '').toLowerCase().includes(q)
                const matchCreator = (t.created_by_name || '').toLowerCase().includes(q)
                const matchAssignee = (t.assigned_to_name || '').toLowerCase().includes(q)
                return matchCode || matchTitle || matchContent || matchCreator || matchAssignee
            })
        }

        // Sort: việc của đội người dùng lên trước, việc chưa xong lên trước, mới nhất lên trước
        return list.sort((a, b) => {
            const isAMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(a, name)) || a.assigned_to === profile?.id
            const isBMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(b, name)) || b.assigned_to === profile?.id

            if (isAMyTeam && !isBMyTeam) return -1
            if (!isAMyTeam && isBMyTeam) return 1

            if (a.status !== 'completed' && b.status === 'completed') return -1
            if (a.status === 'completed' && b.status !== 'completed') return 1

            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })
    }, [tasks, activeTab, selectedTeamFilter, searchQuery, myTeamNames, profile?.id, profile?.full_name])

    // Phân trang 12 công việc / lời nhắc mỗi trang
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 12

    useEffect(() => {
        setCurrentPage(1)
    }, [activeTab, selectedTeamFilter, searchQuery])

    const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE) || 1

    const paginatedTasks = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE
        return filteredTasks.slice(start, start + PAGE_SIZE)
    }, [filteredTasks, currentPage])

    return (
        <div className="min-h-screen bg-stone-100 pb-24 font-sans text-stone-800 antialiased selection:bg-purple-100">
            {/* 1. Sticky Mobile App Bar */}
            <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 px-3.5 py-2.5 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-700 to-indigo-600 flex items-center justify-center text-white shadow-sm flex-shrink-0">
                            <LayoutGrid className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-sm font-extrabold text-stone-900 leading-tight">
                                Bàn Giao & Lời Nhắc Việc
                            </h1>
                            <p className="text-[11px] text-stone-500 font-medium">
                                {currentSystem?.name || (isSanxuat ? 'Hệ thống Sản Xuất' : 'Hệ thống Kho Vận')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        {/* Search toggle button */}
                        <button
                            onClick={() => {
                                setShowSearch(!showSearch)
                                if (showSearch) setSearchQuery('')
                            }}
                            className={`p-2 rounded-xl transition ${
                                showSearch || searchQuery
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-stone-600 hover:bg-stone-100'
                            }`}
                            aria-label="Tìm kiếm"
                        >
                            <Search className="w-4 h-4" />
                        </button>

                        {/* Refresh button */}
                        <button
                            onClick={onRefresh}
                            disabled={refreshing}
                            className="p-2 rounded-xl text-stone-600 hover:bg-stone-100 active:scale-95 transition"
                            title="Làm mới dữ liệu"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-600' : ''}`} />
                        </button>

                        {/* Switch to Desktop button (if desktop monitor available) */}
                        {onSwitchToDesktop && (
                            <button
                                onClick={onSwitchToDesktop}
                                className="p-2 rounded-xl text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                                title="Chuyển sang giao diện máy tính"
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Search Input Bar (Expandable) */}
                {showSearch && (
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center gap-2">
                        <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm mã việc #, tên việc, người giao..."
                                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-stone-100 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 border-0"
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2 text-stone-400 hover:text-stone-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </header>

            {/* 2. Banner thông báo việc mới cần tiếp nhận (nếu có) */}
            {unackTasksForMe.length > 0 && activeTab !== 'unack' && (
                <div className="mx-3 mt-2.5">
                    <div
                        onClick={() => {
                            setActiveTab('unack')
                            setSelectedTeamFilter(null)
                        }}
                        className="bg-gradient-to-r from-rose-600 to-red-600 text-white p-3 rounded-2xl shadow-md shadow-rose-200 flex items-center justify-between cursor-pointer active:scale-[0.99] transition"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center animate-bounce flex-shrink-0">
                                <Bell className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <div className="text-xs font-black tracking-wide flex items-center gap-1.5">
                                    <span>CẦN BẠN TIẾP NHẬN</span>
                                    <span className="bg-white text-rose-700 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                                        {unackTasksForMe.length}
                                    </span>
                                </div>
                                <div className="text-[11px] text-white/90">
                                    Có lời nhắc việc mới giao cho bạn hoặc đội bạn
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-xl flex-shrink-0">
                            <span>Xem ngay</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Filter Bar (Hiện đại, không cần vuốt, có Menu đầy đủ) */}
            <div className="sticky top-[53px] z-20 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-3 py-2 shadow-2xs space-y-2">
                {/* Row 1: Segment Chế độ xem & Nút Menu Danh mục */}
                <div className="flex items-center gap-2">
                    {/* Segmented Switcher */}
                    <div className="flex-1 grid grid-cols-2 p-1 bg-stone-100 rounded-xl">
                        <button
                            onClick={() => {
                                setActiveTab('teams')
                                setSelectedTeamFilter(null)
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                activeTab === 'teams'
                                    ? 'bg-white text-purple-800 shadow-2xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5 text-purple-600" />
                            <span>Theo Tổ đội</span>
                            {unackTasksForMe.length > 0 && (
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                            )}
                        </button>

                        <button
                            onClick={() => {
                                if (activeTab === 'teams') setActiveTab('all')
                                setSelectedTeamFilter(null)
                            }}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                activeTab !== 'teams'
                                    ? 'bg-white text-stone-900 shadow-2xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Danh sách ({tasks.length})</span>
                        </button>
                    </div>

                    {/* Nút Menu Bộ Lọc & Danh Mục */}
                    <button
                        onClick={() => setShowMenuSheet(true)}
                        className={`py-1.5 px-2.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition active:scale-95 flex-shrink-0 ${
                            activeTab !== 'teams' && activeTab !== 'all'
                                ? 'bg-purple-50 border-purple-300 text-purple-800'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                        title="Mở menu danh mục & bộ lọc"
                    >
                        <Filter className="w-3.5 h-3.5 text-purple-600" />
                        <span>Menu</span>
                        {activeTab !== 'teams' && activeTab !== 'all' && (
                            <span className="w-2 h-2 rounded-full bg-purple-600" />
                        )}
                    </button>
                </div>

                {/* Row 2: Bộ lọc nhanh khi ở chế độ Danh sách việc (4 ô vừa khít màn hình, KHÔNG CẦN VUỐT) */}
                {activeTab !== 'teams' && (
                    <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        {/* 1. Tất cả */}
                        <button
                            onClick={() => {
                                setActiveTab('all')
                                setSelectedTeamFilter(null)
                            }}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center truncate transition ${
                                activeTab === 'all'
                                    ? 'bg-stone-900 text-white shadow-2xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            Tất cả ({tasks.length})
                        </button>

                        {/* 2. Chờ bạn nhận */}
                        <button
                            onClick={() => {
                                setActiveTab('unack')
                                setSelectedTeamFilter(null)
                            }}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center truncate transition relative ${
                                activeTab === 'unack'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : unackTasksForMe.length > 0
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            Chờ nhận {unackTasksForMe.length > 0 ? `(${unackTasksForMe.length})` : ''}
                        </button>

                        {/* 3. Tôi giao */}
                        <button
                            onClick={() => {
                                setActiveTab('created_by_me')
                                setSelectedTeamFilter(null)
                            }}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center truncate transition ${
                                activeTab === 'created_by_me'
                                    ? 'bg-purple-700 text-white shadow-2xs'
                                    : myCreatedTasks.length > 0
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200/80'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            Tôi giao ({myCreatedTasks.length})
                        </button>

                        {/* 4. Menu thêm */}
                        <button
                            onClick={() => setShowMenuSheet(true)}
                            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold text-center truncate transition flex items-center justify-center gap-0.5 ${
                                ['in_progress', 'completed', 'my_tasks'].includes(activeTab)
                                    ? 'bg-purple-700 text-white shadow-2xs'
                                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                        >
                            <span>
                                {activeTab === 'in_progress'
                                    ? 'Đang làm'
                                    : activeTab === 'completed'
                                    ? 'Đã xong'
                                    : activeTab === 'my_tasks'
                                    ? 'Của tôi'
                                    : 'Thêm ▾'}
                            </span>
                        </button>
                    </div>
                )}

                {/* Hiển thị nếu đang lọc theo một đội cụ thể */}
                {selectedTeamFilter && (
                    <div className="mt-1.5 flex items-center justify-between text-xs bg-purple-50 text-purple-800 px-2.5 py-1 rounded-lg border border-purple-200">
                        <span>Đang lọc theo: <strong>{selectedTeamFilter}</strong></span>
                        <button
                            onClick={() => setSelectedTeamFilter(null)}
                            className="text-purple-600 hover:text-purple-900 font-bold ml-2"
                        >
                            Bỏ lọc ✕
                        </button>
                    </div>
                )}
            </div>

            {/* PWA Push Notification & Vibration Prompt Banner */}
            {isPushSupported && (
                !isPushSubscribed ? (
                    pushPermission === 'denied' ? (
                        <div className="mx-3 mt-2 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <strong className="block font-bold">Quyền thông báo đang bị chặn trên trình duyệt</strong>
                                <span className="text-[11px] text-amber-700">
                                    Hãy bấm vào biểu tượng ổ khóa 🔒 trên thanh địa chỉ ➔ Chọn &quot;Quyền trang web&quot; ➔ Bật &quot;Thông báo&quot; để nhận chuông báo nhé.
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="mx-3 mt-2 p-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-md flex items-center justify-between gap-3 animate-in fade-in">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                    <Bell className="w-4 h-4 text-white animate-bounce" />
                                </div>
                                <div className="min-w-0">
                                    <h5 className="font-bold text-xs leading-tight">Bật chuông báo &amp; số đỏ trên icon</h5>
                                    <p className="text-[10px] text-emerald-100 truncate">Rung chuông khi có việc mới giao cho đội</p>
                                </div>
                            </div>
                            <button
                                onClick={() => subscribePush()}
                                disabled={pushLoading}
                                className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-bold shadow-sm active:scale-95 transition flex-shrink-0"
                            >
                                {pushLoading ? 'Đang bật...' : 'Bật ngay'}
                            </button>
                        </div>
                    )
                ) : (
                    <div className="mx-3 mt-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span className="font-semibold truncate">Chuông &amp; số đỏ: <strong>Đang bật</strong></span>
                        </div>
                        <button
                            onClick={handleTestPush}
                            disabled={testingPush}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[10px] font-bold shadow-2xs hover:bg-emerald-700 active:scale-95 transition flex-shrink-0"
                        >
                            {testingPush ? 'Đang gửi...' : 'Thử chuông ngay'}
                        </button>
                    </div>
                )
            )}

            {/* 4. Nội Dung Chính */}
            <main className="p-3 space-y-3">
                {/* 4A. TAB TỔ ĐỘI */}
                {activeTab === 'teams' && !selectedTeamFilter ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
                            <span>Tình hình nhận việc theo đội ({teamItems.length} đội)</span>
                            <span className="text-[11px]">Chạm vào đội để xem chi tiết</span>
                        </div>

                        {teamItems.map(item => {
                            const hasUnack = item.isMyTeam ? item.unackCount > 0 : item.teamUnackCount > 0
                            const currentStage = getTeamStage(item.team.id)

                            // Chọn danh sách công việc theo phân loại tab
                            const displayedTasks = (() => {
                                if (currentStage === 'waiting_ack') return item.waitingAckTasks
                                if (currentStage === 'acknowledged') return item.acknowledgedTasks
                                if (currentStage === 'completed') return item.completedTasksList
                                return item.latestTasks
                            })()

                            // Mặc định tab Mới nhất chỉ hiển thị 1 công việc mới nhất để card siêu gọn
                            const tasksToShow = currentStage === 'latest'
                                ? displayedTasks.slice(0, 1)
                                : displayedTasks.slice(0, 3)

                            return (
                                <div
                                    key={item.team.id}
                                    className={`bg-white rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${
                                        item.isMyTeam
                                            ? 'border-purple-300 ring-2 ring-purple-100 bg-gradient-to-b from-purple-50/20 to-white'
                                            : 'border-stone-200'
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div className="p-3 border-b border-stone-100 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                                        item.isMyTeam
                                                            ? 'bg-purple-600 text-white shadow-sm'
                                                            : 'bg-stone-100 text-stone-700'
                                                    }`}
                                                >
                                                    {item.team.name.slice(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <h3 className="font-extrabold text-sm text-stone-900 truncate">
                                                        {item.team.name}
                                                    </h3>
                                                    {item.isMyTeam && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200/80 inline-flex items-center gap-0.5 flex-shrink-0 leading-none">
                                                            ⭐ Đội của bạn
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            {item.isMyTeam ? (
                                                hasUnack ? (
                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-600 text-white font-black text-[11px] shadow-sm animate-pulse flex-shrink-0">
                                                        <Bell className="w-3 h-3" />
                                                        <span>{item.unackCount} việc mới</span>
                                                    </div>
                                                ) : item.total > 0 ? (
                                                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex-shrink-0">
                                                        <Check className="w-3 h-3" />
                                                        <span>Đã nhận hết</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10.5px] text-stone-400 px-2 py-0.5 rounded-full bg-stone-50 border border-stone-100 flex-shrink-0">
                                                        Chưa có việc
                                                    </div>
                                                )
                                            ) : (
                                                item.teamUnackCount > 0 ? (
                                                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500 text-white font-bold text-[11px] shadow-xs flex-shrink-0">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{item.teamUnackCount} chưa nhận</span>
                                                    </div>
                                                ) : item.total > 0 ? (
                                                    <div className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex-shrink-0">
                                                        <Check className="w-3 h-3" />
                                                        <span>Đội đã nhận hết</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10.5px] text-stone-400 px-2 py-0.5 rounded-full bg-stone-50 border border-stone-100 flex-shrink-0">
                                                        Chưa có việc
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        <div className="pl-10 text-[11px] text-stone-500 flex items-center gap-2">
                                            <span>Tổng: <strong>{item.total}</strong> việc</span>
                                        </div>
                                    </div>

                                    {/* 4-Stage Segment Tabs: Mới nhất | Chờ xác nhận | Đã xác nhận | Hoàn thành */}
                                    <div className="px-3 pt-2.5 pb-1 border-b border-stone-100 bg-stone-50/50">
                                        <div className="grid grid-cols-4 gap-1 p-1 bg-stone-200/70 rounded-xl text-center text-[10.5px] font-bold">
                                            {/* 1. Mới nhất */}
                                            <button
                                                type="button"
                                                onClick={() => setTeamStage(item.team.id, 'latest')}
                                                className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                    currentStage === 'latest'
                                                        ? 'bg-white text-stone-900 shadow-2xs'
                                                        : 'text-stone-600 hover:text-stone-900'
                                                }`}
                                            >
                                                <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                                <span>Mới nhất</span>
                                            </button>

                                            {/* 2. Chờ nhận */}
                                            <button
                                                type="button"
                                                onClick={() => setTeamStage(item.team.id, 'waiting_ack')}
                                                className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                    currentStage === 'waiting_ack'
                                                        ? 'bg-white text-rose-700 shadow-2xs'
                                                        : 'text-stone-600 hover:text-rose-700'
                                                }`}
                                            >
                                                <span>Chờ nhận</span>
                                                {item.waitingAckTasks.length > 0 && (
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                                        currentStage === 'waiting_ack'
                                                            ? 'bg-rose-600 text-white'
                                                            : 'bg-rose-100 text-rose-700'
                                                    }`}>
                                                        {item.waitingAckTasks.length}
                                                    </span>
                                                )}
                                            </button>

                                            {/* 3. Đã nhận */}
                                            <button
                                                type="button"
                                                onClick={() => setTeamStage(item.team.id, 'acknowledged')}
                                                className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                    currentStage === 'acknowledged'
                                                        ? 'bg-white text-blue-700 shadow-2xs'
                                                        : 'text-stone-600 hover:text-blue-700'
                                                }`}
                                            >
                                                <span>Đã nhận</span>
                                                {item.acknowledgedTasks.length > 0 && (
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                                        currentStage === 'acknowledged'
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {item.acknowledgedTasks.length}
                                                    </span>
                                                )}
                                            </button>

                                            {/* 4. Hoàn thành */}
                                            <button
                                                type="button"
                                                onClick={() => setTeamStage(item.team.id, 'completed')}
                                                className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                    currentStage === 'completed'
                                                        ? 'bg-white text-emerald-700 shadow-2xs'
                                                        : 'text-stone-600 hover:text-emerald-700'
                                                }`}
                                            >
                                                <span>Đã xong</span>
                                                {item.completedTasksList.length > 0 && (
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                                                        currentStage === 'completed'
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {item.completedTasksList.length}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Body: Danh sách công việc theo tab stage */}
                                    <div className="p-3 space-y-2">
                                        {displayedTasks.length === 0 ? (
                                            <div className="py-4 text-center text-stone-400">
                                                {currentStage === 'waiting_ack' && (
                                                    <div className="space-y-0.5">
                                                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                                                        <p className="text-xs font-semibold text-emerald-700">Không có việc chờ tiếp nhận</p>
                                                    </div>
                                                )}
                                                {currentStage === 'acknowledged' && (
                                                    <p className="text-xs font-medium">Chưa có việc nào đang xử lý</p>
                                                )}
                                                {currentStage === 'completed' && (
                                                    <p className="text-xs font-medium">Chưa có việc nào đã hoàn thành</p>
                                                )}
                                                {currentStage === 'latest' && (
                                                    <p className="text-xs font-medium">Đội chưa có thông báo nào</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                {tasksToShow.map(task => {
                                                    const isTaskCompleted = task.status === 'completed'
                                                    const isTaskInProgress = task.status === 'in_progress'
                                                    const isCreatedByMe = Boolean(
                                                        (profile?.id && task.created_by && profile.id === task.created_by) ||
                                                        (profile?.full_name && task.created_by_name && profile.full_name.trim().toLowerCase() === task.created_by_name.trim().toLowerCase())
                                                    )
                                                    const canAckThisTask = canUserAcknowledgeTask(task, profile, rawMyTeamNames, allMembers, teams)
                                                    const needsMyAck = !isTaskCompleted && !hasUserAcknowledged(task, profile?.id, profile?.full_name) && canAckThisTask

                                                    return (
                                                        <div
                                                            key={task.id}
                                                            onClick={() => onSelectTask(task)}
                                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 shadow-2xs active:bg-stone-50 cursor-pointer transition ${
                                                                isTaskCompleted
                                                                    ? 'bg-emerald-50/20 border-emerald-200'
                                                                    : needsMyAck
                                                                    ? 'bg-rose-50/30 border-rose-200'
                                                                    : isTaskInProgress
                                                                    ? 'bg-blue-50/20 border-blue-200'
                                                                    : 'bg-white border-stone-200'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-mono text-[10px] font-bold text-stone-500">
                                                                        #{task.code}
                                                                    </span>
                                                                    {isTaskCompleted ? (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-700">
                                                                            Đã xong
                                                                        </span>
                                                                    ) : needsMyAck ? (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 animate-pulse">
                                                                            Chờ bạn nhận
                                                                        </span>
                                                                    ) : isCreatedByMe ? (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                                                                            Bạn đã giao
                                                                        </span>
                                                                    ) : isTaskInProgress ? (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-700">
                                                                            Đang làm
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                                                                            Chờ đội nhận
                                                                        </span>
                                                                    )}
                                                                    {task.priority === 'urgent' && (
                                                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                                                            GẤP
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs font-bold text-stone-800 truncate mt-0.5">
                                                                    {task.title}
                                                                </div>
                                                                <div className="text-[10px] text-stone-400 mt-0.5 truncate">
                                                                    Giao bởi {task.created_by_name || 'Nhân viên'} • {formatDateRelative(task.created_at)}
                                                                </div>
                                                            </div>

                                                            {needsMyAck ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => onQuickAcknowledge(e, task)}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 flex-shrink-0"
                                                                >
                                                                    <Check className="w-3 h-3" />
                                                                    <span>Nhận</span>
                                                                </button>
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    )
                                                })}

                                                {currentStage === 'latest' && item.total > 1 && (
                                                    <div className="text-center pt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedTeamFilter(item.team.name)
                                                                setActiveTab('all')
                                                            }}
                                                            className="text-[11px] text-purple-700 font-bold hover:underline inline-flex items-center gap-0.5"
                                                        >
                                                            <span>+{item.total - 1} việc khác của đội...</span>
                                                            <ChevronRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}

                                                {currentStage !== 'latest' && displayedTasks.length > 3 && (
                                                    <div className="text-center pt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedTeamFilter(item.team.name)
                                                                setActiveTab('all')
                                                            }}
                                                            className="text-[11px] text-purple-700 font-bold hover:underline inline-flex items-center gap-0.5"
                                                        >
                                                            <span>+{displayedTasks.length - 3} việc khác trong mục này...</span>
                                                            <ChevronRight className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Bar dưới chân Card đội */}
                                    <div className="px-3.5 py-2.5 bg-stone-50/60 flex items-center justify-between text-xs">
                                        <button
                                            onClick={() => {
                                                setSelectedTeamFilter(item.team.name)
                                                setActiveTab('all')
                                            }}
                                            className="font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 py-1"
                                        >
                                            <span>Xem {item.total} việc của đội</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>

                                        <button
                                            onClick={() => onCreateTask(`Đội ${item.team.name}`)}
                                            className="px-2 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-semibold hover:bg-stone-100 text-[11px] flex items-center gap-1 shadow-2xs"
                                        >
                                            <Plus className="w-3 h-3 text-purple-600" />
                                            <span>Giao việc</span>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    /* 4B. TAB DANH SÁCH THẺ CÔNG VIỆC MOBILE */
                    <div className="space-y-3">
                        {filteredTasks.length === 0 ? (
                            <div className="text-center py-12 px-4 bg-white rounded-2xl border border-stone-200 space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-stone-300 mx-auto" />
                                <h4 className="font-bold text-stone-700 text-sm">Không có công việc nào</h4>
                                <p className="text-xs text-stone-400 max-w-xs mx-auto">
                                    Không tìm thấy việc nào theo bộ lọc hiện tại hoặc bạn đã hoàn tất mọi việc!
                                </p>
                                <button
                                    onClick={() => {
                                        setActiveTab('teams')
                                        setSelectedTeamFilter(null)
                                        setSearchQuery('')
                                    }}
                                    className="mt-2 px-3 py-1.5 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs"
                                >
                                    Quay lại Tổng quan Đội
                                </button>
                            </div>
                        ) : (
                            paginatedTasks.map(task => {
                                const isPending = task.status === 'pending'
                                const isInProgress = task.status === 'in_progress'
                                const isCompleted = task.status === 'completed'

                                const acks = getDeduplicatedAcknowledgements(task)
                                const hasMyAck = acks.some(a => 
                                    (profile?.id && a.user_id && a.user_id === profile.id) || 
                                    (profile?.full_name && a.user_name && a.user_name.trim().toLowerCase() === profile.full_name.trim().toLowerCase())
                                )
                                const isCreatorOrAdmin = canManageTask(task, profile)

                                const shiftsList: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
                                    ? task.target_shifts
                                    : (task.target_shift ? task.target_shift.split(',').map((s: string) => s.trim()).filter(Boolean) : [])

                                return (
                                    <div
                                        key={task.id}
                                        onClick={() => onSelectTask(task)}
                                        className={`bg-white rounded-2xl border transition-all duration-150 shadow-xs relative overflow-hidden active:scale-[0.99] cursor-pointer flex flex-col justify-between ${
                                            isPending
                                                ? 'border-amber-200'
                                                : isInProgress
                                                ? 'border-blue-200'
                                                : 'border-stone-200 opacity-90'
                                        }`}
                                    >
                                        {/* Status Top Line */}
                                        <div
                                            className={`h-1.5 w-full ${
                                                task.priority === 'urgent'
                                                    ? 'bg-red-500'
                                                    : isPending
                                                    ? 'bg-amber-500'
                                                    : isInProgress
                                                    ? 'bg-blue-500'
                                                    : 'bg-emerald-500'
                                            }`}
                                        />

                                        <div className="p-3.5 space-y-2">
                                            {/* Header row: Code, Priority, Shifts */}
                                            <div className="flex items-center justify-between gap-1.5">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                                        #{task.code}
                                                    </span>

                                                    {(() => {
                                                        const tType = getTaskType(task)
                                                        return (
                                                            <span
                                                                className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${
                                                                    tType === 'reminder'
                                                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                        : 'bg-blue-50 text-blue-800 border-blue-200'
                                                                }`}
                                                            >
                                                                {tType === 'reminder' ? '🔔 LỜI NHẮC' : '📋 VIỆC'}
                                                            </span>
                                                        )
                                                    })()}

                                                    {task.priority === 'urgent' && (
                                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                                            Khẩn cấp
                                                        </span>
                                                    )}

                                                    {shiftsList.slice(0, 2).map((shift, idx) => {
                                                        const isAll = shift === 'Toàn bộ' || shift === 'Toàn đội'
                                                        return (
                                                            <span
                                                                key={idx}
                                                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                                                                    isAll
                                                                        ? 'bg-purple-700 text-white border-purple-700'
                                                                        : shift.startsWith('Đội')
                                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                                                }`}
                                                            >
                                                                {isAll ? '🏢 Toàn bộ' : shift}
                                                            </span>
                                                        )
                                                    })}

                                                    {(() => {
                                                        const isCreatedByMe = Boolean(
                                                            (profile?.id && task.created_by && profile.id === task.created_by) ||
                                                            (profile?.full_name && task.created_by_name && profile.full_name.trim().toLowerCase() === task.created_by_name.trim().toLowerCase())
                                                        )
                                                        if (isCreatedByMe) {
                                                            return (
                                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                                                                    📤 Bạn đã giao
                                                                </span>
                                                            )
                                                        }
                                                        return null
                                                    })()}

                                                </div>

                                                <span className="text-[11px] text-stone-400 whitespace-nowrap flex-shrink-0">
                                                    {formatDateRelative(task.created_at)}
                                                </span>
                                            </div>

                                            {/* Title & Content */}
                                            <div>
                                                <h4 className="font-bold text-sm text-stone-900 leading-snug line-clamp-2">
                                                    {task.title}
                                                </h4>
                                                {task.content && getCardContentPreview(task.content) && (
                                                    <p className="text-xs text-stone-600 line-clamp-2 mt-1">
                                                        {getCardContentPreview(task.content)}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Image Thumbnails preview */}
                                            {(() => {
                                                const cardImages = (task.images && task.images.length > 0)
                                                    ? task.images
                                                    : extractInlineImageUrls(task.content)
                                                if (!cardImages || cardImages.length === 0) return null

                                                return (
                                                    <div className="flex items-center gap-1.5 pt-1">
                                                        {cardImages.slice(0, 3).map((img, idx) => (
                                                            <div
                                                                key={idx}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    onImageClick(cardImages, idx)
                                                                }}
                                                                className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 flex-shrink-0 relative cursor-pointer"
                                                            >
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={img}
                                                                    alt={`Ảnh ${idx + 1}`}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        ))}
                                                        {cardImages.length > 3 && (
                                                            <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
                                                                +{cardImages.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}

                                            {/* Multi-team progress breakdown */}
                                            {(() => {
                                                const isReminder = getTaskType(task) === 'reminder'
                                                const teamProgress = getTaskTeamProgress(task, allMembers, teams)
                                                if (teamProgress.total <= 1) return null

                                                return (
                                                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1.5 mt-2">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-stone-700 flex items-center gap-1">
                                                                <Users className="w-3 h-3 text-purple-600" />
                                                                {isReminder ? 'Tiến độ tiếp nhận:' : 'Tiến độ các đội:'}
                                                            </span>
                                                            <span className={`font-black px-2 py-0.5 rounded-md text-[10px] ${
                                                                teamProgress.isAllCompleted
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : teamProgress.completedCount > 0
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : 'bg-stone-200/80 text-stone-700'
                                                            }`}>
                                                                {teamProgress.ratioText} {isReminder ? 'đội đã nhận' : 'đội xong'} ({teamProgress.percent}%)
                                                            </span>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full transition-all duration-300 ${teamProgress.isAllCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'}`}
                                                                style={{ width: `${teamProgress.percent}%` }}
                                                            />
                                                        </div>

                                                        {/* Teams breakdown tags */}
                                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                                            {teamProgress.assignedTeams.map(t => {
                                                                const isDone = isTeamCompleted(task, t) || (isReminder && isTeamAcknowledged(task, t, allMembers, teams))
                                                                const isAcked = isTeamAcknowledged(task, t, allMembers, teams)
                                                                const memberInfo = getTeamMemberAckInfo(task, t, allMembers, teams)
                                                                const memberRatioStr = memberInfo.totalMembers > 0
                                                                    ? ` (${memberInfo.ackedCount}/${memberInfo.totalMembers})`
                                                                    : (memberInfo.ackedCount > 0 ? ` (${memberInfo.ackedCount})` : '')

                                                                let label = 'Chưa nhận'
                                                                let tagClass = 'bg-white border-stone-200 text-stone-500'
                                                                let Icon = Clock

                                                                if (isDone) {
                                                                    label = isReminder ? 'Đã nhận' : 'Đã xong'
                                                                    tagClass = 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                                    Icon = CheckCircle2
                                                                } else if (isAcked) {
                                                                    label = 'Đang làm'
                                                                    tagClass = 'bg-blue-50 border-blue-300 text-blue-800'
                                                                    Icon = Clock
                                                                }

                                                                return (
                                                                    <span
                                                                        key={t}
                                                                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${tagClass}`}
                                                                    >
                                                                        <Icon className="w-2.5 h-2.5" />
                                                                        <span>{t}: {label}{memberRatioStr}</span>
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })()}

                                            {/* Footer metadata: Người giao & Ai đã nhận */}
                                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                                                <div className="truncate max-w-[62%] flex items-center gap-1">
                                                    <span className="truncate">Giao: <strong className="text-stone-700">{task.created_by_name || 'Hệ thống'}</strong></span>
                                                    {task.assigned_to_name && (
                                                        <span className="text-[9px] text-blue-700 bg-blue-50 border border-blue-200 px-1 py-0.2 rounded font-medium flex items-center gap-0.5 flex-shrink-0" title={`Chỉ định cho ${task.assigned_to_name}`}>
                                                            <UserCheck className="w-2.5 h-2.5 flex-shrink-0" />
                                                            <span className="truncate max-w-[70px]">{task.assigned_to_name}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    {acks.length > 0 ? (
                                                        <span className="text-emerald-700 font-semibold">
                                                            ✓ {acks.length} người đã nhận
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 font-semibold">
                                                            Chưa ai nhận
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* NÚT THAO TÁC 1 CHẠM CHO NGÓN CÁI (THUMB ACTION) */}
                                        <div className="p-2.5 bg-stone-50/80 border-t border-stone-100 flex items-center justify-between gap-2">
                                            {/* Trạng thái xác nhận của người dùng hiện tại */}
                                            {(() => {
                                                const isReminder = getTaskType(task) === 'reminder'
                                                const completionInfo = canUserCompleteTeamTask(task, profile, rawMyTeamNames)
                                                const teamProgress = getTaskTeamProgress(task, allMembers, teams)
                                                const canAcknowledge = canUserAcknowledgeTask(task, profile, rawMyTeamNames, allMembers, teams)
                                                const isDone = isCompleted || teamProgress.isAllCompleted

                                                if (isDone) {
                                                    return (
                                                        <div className="w-full text-center py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                                                            ✓ Đã hoàn thành lúc {formatDateTime(task.completed_at || task.created_at)}
                                                        </div>
                                                    )
                                                }

                                                if (!hasMyAck && canAcknowledge) {
                                                    return (
                                                        <button
                                                            onClick={(e) => onQuickAcknowledge(e, task)}
                                                            className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 active:from-emerald-700 active:to-teal-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                            <span>XÁC NHẬN TIẾP NHẬN VIỆC</span>
                                                        </button>
                                                    )
                                                }

                                                return (
                                                    <div className="w-full flex items-center justify-between gap-2">
                                                        {hasMyAck ? (
                                                            <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100/60 px-2.5 py-1.5 rounded-xl">
                                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Đã tiếp nhận</span>
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-stone-500 font-medium bg-stone-100/80 px-2 py-1 rounded-xl">
                                                                Đang chờ các đội
                                                            </div>
                                                        )}

                                                        {completionInfo.canComplete ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    onOpenCompleteModal(task)
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-blue-600 active:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {completionInfo.eligibleTeams.length === 1
                                                                        ? `Báo hoàn thành (${completionInfo.eligibleTeams[0].replace(/^Đội\s+/, '')})`
                                                                        : 'Báo hoàn thành'}
                                                                </span>
                                                            </button>
                                                        ) : completionInfo.alreadyCompletedTeams.length > 0 ? (
                                                            <div className="flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-100/80 border border-emerald-300 px-2.5 py-1 rounded-xl">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Đội bạn đã xong</span>
                                                            </div>
                                                        ) : task.assigned_to_name && !isReminder ? (
                                                            <span className="text-[11px] text-blue-700 font-medium truncate flex items-center gap-1" title={`Chỉ định riêng cho ${task.assigned_to_name} báo cáo`}>
                                                                <UserCheck className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                                                <span className="truncate">Chỉ định: <strong>{task.assigned_to_name}</strong></span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-stone-400 italic">
                                                                Chờ các đội thực hiện
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}

                                            {/* Action nhỏ cho người tạo hoặc quản trị viên */}
                                            {isCreatorOrAdmin && (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onOpenEditModal(task)
                                                        }}
                                                        className="p-2 rounded-xl text-stone-500 hover:text-amber-700 hover:bg-stone-100 transition"
                                                        title="Sửa"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => onQuickDelete(e, task)}
                                                        className="p-2 rounded-xl text-stone-500 hover:text-red-700 hover:bg-stone-100 transition"
                                                        title="Xóa"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}

                        {/* Mobile Pagination Bar */}
                        {filteredTasks.length > PAGE_SIZE && (
                            <div className="flex items-center justify-between gap-2 pt-3 pb-6 px-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700 shadow-2xs active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Trang trước</span>
                                </button>

                                <span className="text-xs font-bold text-stone-700 bg-white border border-stone-200 px-3 py-2 rounded-xl shadow-2xs">
                                    Trang {currentPage} / {totalPages}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-xs font-bold text-stone-700 shadow-2xs active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition"
                                >
                                    <span>Trang sau</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* 5. FLOATING ACTION BUTTON (FAB) - TẠO VIỆC NHANH VỪA TẦM VỚI NGÓN CÁI */}
            <div className="fixed bottom-5 right-4 z-40">
                <button
                    onClick={() => onCreateTask()}
                    className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/40 ring-4 ring-white flex items-center justify-center active:scale-90 transition-all group"
                    aria-label="Tạo lời nhắc việc mới"
                >
                    <Plus className="w-7 h-7 stroke-[2.5]" />
                </button>
            </div>

            {/* 6. BOTTOM SHEET MENU - DANH MỤC & BỘ LỌC CÔNG VIỆC TRÊN MOBILE (KHÔNG CẦN VUỐT NGANG) */}
            {showMenuSheet && (
                <div 
                    className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
                    onClick={() => setShowMenuSheet(false)}
                >
                    <div 
                        className="bg-white rounded-t-3xl shadow-2xl p-4 max-h-[85vh] overflow-y-auto pb-8 border-t border-stone-100 flex flex-col space-y-4 animate-in slide-in-from-bottom duration-250"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Thanh gạt & Header */}
                        <div>
                            <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3" />
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-purple-600" />
                                        <span>Danh mục & Bộ lọc việc</span>
                                    </h3>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Chọn chế độ xem hoặc trạng thái nhanh chóng không cần vuốt
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowMenuSheet(false)}
                                    className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Nhóm 1: Chế độ xem & Trạng thái chính */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">
                                Trạng thái & Phân loại
                            </span>

                            {/* Option 1: Theo tổ đội */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('teams')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'teams'
                                        ? 'bg-purple-50 border border-purple-200 text-purple-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <LayoutGrid className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Theo từng Tổ đội</span>
                                            {activeTab === 'teams' && (
                                                <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Xem nhóm việc theo từng ca đội phụ trách
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2 py-1 rounded-lg bg-white border border-stone-200 text-stone-600">
                                    {teams.length} đội
                                </div>
                            </button>

                            {/* Option 2: Tất cả công việc */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('all')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'all' && !selectedTeamFilter
                                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Tất cả công việc</span>
                                            {activeTab === 'all' && !selectedTeamFilter && (
                                                <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Toàn bộ danh sách công việc & lời nhắc trong ca
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700">
                                    {tasks.length}
                                </div>
                            </button>

                            {/* Option 3: Chờ bạn nhận */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('unack')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'unack'
                                        ? 'bg-rose-50 border border-rose-200 text-rose-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Chờ bạn tiếp nhận</span>
                                            {activeTab === 'unack' && (
                                                <span className="text-[10px] bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Việc giao cho bạn hoặc đội bạn chưa bấm nhận
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                    unackTasksForMe.length > 0 
                                        ? 'bg-rose-600 text-white animate-pulse' 
                                        : 'bg-white border border-stone-200 text-stone-600'
                                }`}>
                                    {unackTasksForMe.length}
                                </div>
                            </button>

                            {/* Option 4: Việc tôi đã giao */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('created_by_me')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'created_by_me'
                                        ? 'bg-purple-50 border border-purple-200 text-purple-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Công việc tôi đã giao</span>
                                            {activeTab === 'created_by_me' && (
                                                <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Các đầu việc bạn giao cho các tổ đội/thành viên
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-purple-700">
                                    {myCreatedTasks.length}
                                </div>
                            </button>

                            {/* Option 5: Việc liên quan đến tôi */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('my_tasks')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'my_tasks'
                                        ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <UserCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Việc của tôi & đội tôi</span>
                                            {activeTab === 'my_tasks' && (
                                                <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Bao gồm việc đội bạn, việc chỉ định bạn hoặc bạn giao
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-indigo-700">
                                    {myTasksCount}
                                </div>
                            </button>

                            {/* Option 6: Đang thực hiện */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('in_progress')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'in_progress'
                                        ? 'bg-blue-50 border border-blue-200 text-blue-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Đang thực hiện</span>
                                            {activeTab === 'in_progress' && (
                                                <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Các việc đã được nhận và đang trong quá trình làm
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-blue-700">
                                    {inProgressCount}
                                </div>
                            </button>

                            {/* Option 7: Đã hoàn thành */}
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('completed')
                                    setSelectedTeamFilter(null)
                                    setShowMenuSheet(false)
                                }}
                                className={`w-full p-2.5 rounded-2xl flex items-center justify-between transition text-left ${
                                    activeTab === 'completed'
                                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                                        : 'bg-stone-50 hover:bg-stone-100 text-stone-800'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                            <span>Đã hoàn thành</span>
                                            {activeTab === 'completed' && (
                                                <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded-md font-medium">Đang chọn</span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-stone-500">
                                            Các công việc đã báo cáo hoặc xác nhận xong
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-emerald-700">
                                    {completedCount}
                                </div>
                            </button>
                        </div>

                        {/* Nhóm 2: Lọc nhanh theo Tổ Đội cụ thể */}
                        {teams.length > 0 && (
                            <div className="pt-2 border-t border-stone-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold tracking-wider text-stone-400 uppercase">
                                        Lọc theo tổ đội cụ thể
                                    </span>
                                    {selectedTeamFilter && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTeamFilter(null)}
                                            className="text-xs text-purple-600 font-bold hover:underline"
                                        >
                                            Bỏ lọc đội
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {teams.map(team => {
                                        const teamTaskCount = tasks.filter(t => isTaskAssignedToTeam(t, team.name)).length
                                        const isSelected = selectedTeamFilter === team.name
                                        return (
                                            <button
                                                key={team.id}
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab('all')
                                                    setSelectedTeamFilter(team.name)
                                                    setShowMenuSheet(false)
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                                                    isSelected
                                                        ? 'bg-purple-700 text-white shadow-2xs'
                                                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                                                }`}
                                            >
                                                <span>{team.name}</span>
                                                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                                                    isSelected ? 'bg-white/25 text-white' : 'bg-white text-stone-600'
                                                }`}>
                                                    {teamTaskCount}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
