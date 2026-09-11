'use client'

import React, { useState, useMemo } from 'react'
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
    ChevronRight,
    Sparkles,
    Pencil,
    Trash2,
    Image as ImageIcon,
    CheckCircle2,
    Monitor,
    X,
    Filter,
    ArrowUpDown
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
    getTaskTeamProgress,
    canUserCompleteTeamTask
} from './taskUtils'
import { usePushNotifications } from '@/hooks/usePushNotifications'

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

    // Total unacknowledged tasks for the current logged-in user
    const unackTasksForMe = useMemo(() => {
        return tasks.filter(t => 
            t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
        )
    }, [tasks, profile?.id, profile?.full_name])

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

            return {
                team,
                isMyTeam,
                total,
                unackTasks,
                unackCount: unackTasks.length,
                teamUnackCount: teamUnackTasks.length,
                teamUnackTasks,
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
                t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
            )
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

            {/* 3. Filter Pills Bar (Cuộn ngang một chạm) */}
            <div className="sticky top-[53px] z-20 bg-white/90 backdrop-blur border-b border-stone-200/80 px-3 py-2 shadow-2xs">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                    {/* Tab: 🏢 Tổ đội */}
                    <button
                        onClick={() => {
                            setActiveTab('teams')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'teams'
                                ? 'bg-purple-700 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Tổ đội</span>
                        {unackTasksForMe.length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        )}
                    </button>

                    {/* Tab: 👤 Của tôi */}
                    <button
                        onClick={() => {
                            setActiveTab('my_tasks')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'my_tasks'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                    >
                        <span>Của tôi</span>
                    </button>

                    {/* Tab: ⚡ Cần tiếp nhận */}
                    <button
                        onClick={() => {
                            setActiveTab('unack')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'unack'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                    >
                        <Bell className="w-3.5 h-3.5" />
                        <span>Cần tiếp nhận</span>
                        {unackTasksForMe.length > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 rounded-full">
                                {unackTasksForMe.length}
                            </span>
                        )}
                    </button>

                    {/* Tab: 🟡 Chờ làm */}
                    <button
                        onClick={() => {
                            setActiveTab('pending')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'pending'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Chờ làm</span>
                    </button>

                    {/* Tab: 🔵 Đang làm */}
                    <button
                        onClick={() => {
                            setActiveTab('in_progress')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'in_progress'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span>Đang làm</span>
                    </button>

                    {/* Tab: 🟢 Đã xong */}
                    <button
                        onClick={() => {
                            setActiveTab('completed')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'completed'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Đã xong</span>
                    </button>

                    {/* Tab: Tất cả */}
                    <button
                        onClick={() => {
                            setActiveTab('all')
                            setSelectedTeamFilter(null)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition active:scale-95 flex-shrink-0 ${
                            activeTab === 'all'
                                ? 'bg-stone-800 text-white shadow-sm'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                        }`}
                    >
                        <span>Tất cả ({tasks.length})</span>
                    </button>
                </div>

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
                                    <div className="p-3.5 border-b border-stone-100 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                                                    item.isMyTeam
                                                        ? 'bg-purple-600 text-white shadow-sm'
                                                        : 'bg-stone-100 text-stone-700'
                                                }`}
                                            >
                                                {item.team.name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="font-extrabold text-sm text-stone-900">
                                                        {item.team.name}
                                                    </h3>
                                                    {item.isMyTeam && (
                                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-700 border border-purple-200 flex items-center gap-0.5">
                                                            ⭐ Đội của bạn
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                                                    <span>Tổng: <strong>{item.total}</strong> việc</span>
                                                </div>
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
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex-shrink-0">
                                                    <Check className="w-3 h-3" />
                                                    <span>Đã nhận hết</span>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-stone-400 px-2 py-0.5 rounded bg-stone-50">
                                                    Chưa có việc
                                                </div>
                                            )
                                        ) : (
                                            item.teamUnackCount > 0 ? (
                                                <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500 text-white font-bold text-[11px] shadow-xs flex-shrink-0">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{item.teamUnackCount} chưa nhận</span>
                                                </div>
                                            ) : item.total > 0 ? (
                                                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex-shrink-0">
                                                    <Check className="w-3 h-3" />
                                                    <span>Đội đã nhận hết</span>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-stone-400 px-2 py-0.5 rounded bg-stone-50">
                                                    Chưa có việc
                                                </div>
                                            )
                                        )}
                                    </div>

                                    {/* Danh sách việc chưa tiếp nhận cần xử lý ngay */}
                                    {hasUnack && (
                                        <div className="p-3 bg-amber-50/50 space-y-2 border-b border-stone-100">
                                            <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                                                <Flame className="w-3.5 h-3.5 text-amber-600" />
                                                <span>Cần bấm xác nhận tiếp nhận:</span>
                                            </div>
                                            {item.unackTasks.slice(0, 2).map(task => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => onSelectTask(task)}
                                                    className="p-2.5 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-2 shadow-2xs active:bg-stone-50 cursor-pointer"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-[10px] font-bold text-stone-500">
                                                                #{task.code}
                                                            </span>
                                                            {task.priority === 'urgent' && (
                                                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                                                    GẤP
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs font-bold text-stone-800 truncate mt-0.5">
                                                            {task.title}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => onQuickAcknowledge(e, task)}
                                                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 active:bg-emerald-700 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 flex-shrink-0"
                                                    >
                                                        <Check className="w-3 h-3" />
                                                        <span>Nhận</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

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
                            filteredTasks.map(task => {
                                const isPending = task.status === 'pending'
                                const isInProgress = task.status === 'in_progress'
                                const isCompleted = task.status === 'completed'

                                const acks: any[] = Array.isArray(task.acknowledgements) && task.acknowledgements.length > 0
                                    ? task.acknowledgements
                                    : (task.acknowledged_by_name ? [{ user_id: task.acknowledged_by, user_name: task.acknowledged_by_name, acknowledged_at: task.acknowledged_at || task.created_at }] : [])
                                const hasMyAck = acks.some(a => a.user_id === profile?.id || (a.user_name && a.user_name === profile?.full_name))
                                const isCreator = Boolean(
                                    profile?.id === task.created_by ||
                                    (profile?.full_name && task.created_by_name === profile.full_name) ||
                                    profile?.roles?.code === 'admin' ||
                                    (profile as any)?.role === 'admin'
                                )

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

                                                    {task.priority === 'urgent' && (
                                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                                            Khẩn cấp
                                                        </span>
                                                    )}

                                                    {shiftsList.slice(0, 2).map((shift, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                                                                shift.startsWith('Đội')
                                                                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                    : 'bg-blue-50 text-blue-700 border-blue-200'
                                                            }`}
                                                        >
                                                            {shift}
                                                        </span>
                                                    ))}
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
                                                {task.content && (
                                                    <p className="text-xs text-stone-600 line-clamp-2 mt-1">
                                                        {task.content}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Image Thumbnails preview */}
                                            {task.images && task.images.length > 0 && (
                                                <div className="flex items-center gap-1.5 pt-1">
                                                    {task.images.slice(0, 3).map((img, idx) => (
                                                        <div
                                                            key={idx}
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                onImageClick(task.images || [], idx)
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
                                                    {task.images.length > 3 && (
                                                        <span className="text-[11px] font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-lg">
                                                            +{task.images.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Multi-team progress breakdown */}
                                            {(() => {
                                                const teamProgress = getTaskTeamProgress(task)
                                                if (teamProgress.total <= 1) return null

                                                return (
                                                    <div className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1.5 mt-2">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-stone-700 flex items-center gap-1">
                                                                <Users className="w-3 h-3 text-purple-600" />
                                                                Tiến độ các đội:
                                                            </span>
                                                            <span className={`font-black px-2 py-0.5 rounded-md text-[10px] ${
                                                                teamProgress.isAllCompleted
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : teamProgress.completedCount > 0
                                                                    ? 'bg-amber-100 text-amber-800'
                                                                    : 'bg-stone-200/80 text-stone-700'
                                                            }`}>
                                                                {teamProgress.ratioText} đội xong ({teamProgress.percent}%)
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
                                                                const isDone = isTeamCompleted(task, t)
                                                                return (
                                                                    <span
                                                                        key={t}
                                                                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg border ${
                                                                            isDone
                                                                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                                                                : 'bg-white border-stone-200 text-stone-500'
                                                                        }`}
                                                                    >
                                                                        {isDone ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> : <Clock className="w-2.5 h-2.5 text-stone-400" />}
                                                                        <span>{t}: {isDone ? 'Đã xong' : 'Chưa'}</span>
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )
                                            })()}

                                            {/* Footer metadata: Người giao & Ai đã nhận */}
                                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                                                <div className="truncate max-w-[170px]">
                                                    Giao bởi: <strong className="text-stone-700">{task.created_by_name || 'Hệ thống'}</strong>
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
                                                const completionInfo = canUserCompleteTeamTask(task, profile, rawMyTeamNames)
                                                const teamProgress = getTaskTeamProgress(task)
                                                const isDone = isCompleted || teamProgress.isAllCompleted

                                                if (isDone) {
                                                    return (
                                                        <div className="w-full text-center py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
                                                            ✓ Đã hoàn thành lúc {formatDateTime(task.completed_at || task.created_at)}
                                                        </div>
                                                    )
                                                }

                                                if (!hasMyAck) {
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
                                                        <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100/60 px-2.5 py-1.5 rounded-xl">
                                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                                            <span>Đã tiếp nhận</span>
                                                        </div>

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
                                                        ) : (
                                                            <span className="text-[11px] text-stone-400 italic">
                                                                Chờ các đội thực hiện
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}

                                            {/* Action nhỏ cho người tạo */}
                                            {isCreator && (
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
        </div>
    )
}
