'use client'

import { useState } from 'react'
import {
    Users,
    Bell,
    CheckCircle2,
    Clock,
    ShieldCheck,
    ChevronRight,
    Flame,
    Plus,
    Filter,
    Search,
    AlertCircle,
    Check,
    Loader2,
    Calendar,
    ArrowRight,
    Sparkles
} from 'lucide-react'
import { ShiftTask, TaskPriority } from './types'
import { formatDateTime, formatDateRelative, isTaskAssignedToTeam, hasUserAcknowledged, hasTeamAcknowledged, getTaskType, getAssignedTeams, isTaskAssignedToAll } from './taskUtils'

interface TeamsOverviewProps {
    teams: { id: string; name: string }[]
    tasks: ShiftTask[]
    profile: any
    myTeamIds?: string[]
    allMembers?: { id: string; team_id: string | null; user_id: string | null; full_name: string | null }[]
    onSelectTask: (task: ShiftTask) => void
    onQuickAcknowledge: (e: React.MouseEvent, task: ShiftTask) => Promise<void>
    onFilterByTeam: (teamName: string) => void
    onCreateTaskForTeam: (teamName: string) => void
}

type TeamCardStage = 'latest' | 'waiting_ack' | 'acknowledged' | 'completed'

export default function TeamsOverview({
    teams,
    tasks,
    profile,
    myTeamIds = [],
    allMembers = [],
    onSelectTask,
    onQuickAcknowledge,
    onFilterByTeam,
    onCreateTaskForTeam,
}: TeamsOverviewProps) {
    const [teamSearch, setTeamSearch] = useState('')
    const [onlyUnackFilter, setOnlyUnackFilter] = useState(false)
    const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null)
    const [cardStageMap, setCardStageMap] = useState<Record<string, TeamCardStage>>({})

    const getTeamStage = (teamId: string): TeamCardStage => {
        return cardStageMap[teamId] || 'latest'
    }

    const setTeamStage = (teamId: string, stage: TeamCardStage) => {
        setCardStageMap(prev => ({ ...prev, [teamId]: stage }))
    }

    const handleAcknowledgeClick = async (e: React.MouseEvent, task: ShiftTask) => {
        e.stopPropagation()
        setAcknowledgingId(task.id)
        try {
            await onQuickAcknowledge(e, task)
        } finally {
            setAcknowledgingId(null)
        }
    }

    // 1. Group tasks by team
    const teamStats = teams.map((team) => {
        const isMyTeam = myTeamIds.includes(team.id)
        const teamTasks = tasks.filter((t) => isTaskAssignedToTeam(t, team.name))

        // Tasks that current user has NOT acknowledged yet
        const userUnackTasks = teamTasks.filter((t) => {
            const isReminder = getTaskType(t) === 'reminder'
            if (isReminder) {
                return !hasUserAcknowledged(t, profile?.id, profile?.full_name)
            }
            return t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
        })

        // Tasks that NO member of THIS team has acknowledged yet
        const teamUnackTasks = teamTasks.filter((t) => {
            const isReminder = getTaskType(t) === 'reminder'
            if (isReminder) {
                return !hasTeamAcknowledged(t, team, allMembers)
            }
            return t.status !== 'completed' && !hasTeamAcknowledged(t, team, allMembers)
        })

        // Chờ xác nhận: Với đội của mình là việc mình chưa xác nhận; với đội khác là việc chưa ai trong đội xác nhận
        const waitingAckTasks = (isMyTeam ? userUnackTasks : teamUnackTasks).sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        const unackCount = waitingAckTasks.length

        // Đã xác nhận: Chưa hoàn thành nhưng đã có người nhận (hoặc status in_progress hoặc đã ack)
        const acknowledgedTasks = teamTasks.filter((t) => {
            const isReminder = getTaskType(t) === 'reminder'
            if (isReminder) {
                if (t.status === 'completed') return false
                if (isMyTeam) {
                    return hasUserAcknowledged(t, profile?.id, profile?.full_name)
                } else {
                    return hasTeamAcknowledged(t, team, allMembers)
                }
            }
            if (t.status === 'completed') return false
            if (isMyTeam) {
                return hasUserAcknowledged(t, profile?.id, profile?.full_name) || t.status === 'in_progress'
            } else {
                return hasTeamAcknowledged(t, team, allMembers) || t.status === 'in_progress'
            }
        }).sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )

        // Hoàn thành
        const completedTasks = teamTasks.filter((t) => {
            if (t.status !== 'completed') return false
            const isReminder = getTaskType(t) === 'reminder'
            if (isReminder) {
                if (isMyTeam) {
                    return hasUserAcknowledged(t, profile?.id, profile?.full_name)
                }
                return hasTeamAcknowledged(t, team, allMembers)
            }
            return true
        }).sort(
            (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
        )

        // Mới nhất (toàn bộ các việc sắp xếp thời gian giảm dần)
        const latestTasks = [...teamTasks].sort(
            (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )

        return {
            team,
            teamName: team.name,
            isMyTeam,
            total: teamTasks.length,
            pending: teamTasks.filter(t => t.status === 'pending').length,
            inProgress: teamTasks.filter(t => t.status === 'in_progress').length,
            completed: completedTasks.length,
            unacknowledged: waitingAckTasks,
            waitingAckTasks,
            acknowledgedTasks,
            latestTasks,
            completedTasksList: completedTasks,
            unackCount,
            userUnackCount: userUnackTasks.length,
            teamUnackCount: teamUnackTasks.length,
            allTasks: teamTasks,
        }
    })

    // 2. Also check tasks not assigned to any registered team (e.g. Ca 1, Ca 2, Chung)
    const genericTasks = tasks.filter((t) => {
        if (isTaskAssignedToAll(t)) return false
        const assignedTeams = getAssignedTeams(t, teams)
        return assignedTeams.length === 0
    })

    const genericUnacknowledged = genericTasks.filter((t) => {
        const isReminder = getTaskType(t) === 'reminder'
        if (isReminder) {
            return !hasUserAcknowledged(t, profile?.id, profile?.full_name)
        }
        return t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
    })

    // Total unacknowledged tasks for the current logged-in user:
    // If user has specific teams, only count unacknowledged tasks in their teams (+ generic tasks)
    // If user has no specific team (e.g. Admin/Director), count all unacknowledged tasks across teams
    const totalMyUnackCount = myTeamIds.length > 0
        ? teamStats.filter(item => item.isMyTeam).reduce((sum, item) => sum + item.userUnackCount, 0) + genericUnacknowledged.length
        : teamStats.reduce((sum, item) => sum + item.unackCount, 0) + genericUnacknowledged.length

    // Filter and Sort teams: User's team(s) ALWAYS appear first!
    const filteredTeams = teamStats
        .filter((item) => {
            if (teamSearch.trim()) {
                const q = teamSearch.toLowerCase().trim()
                const matchName = String(item.teamName || '').toLowerCase().includes(q)
                const matchTask = (item.allTasks || []).some(
                    (t) => String(t.title || '').toLowerCase().includes(q) || String(t.code || '').toLowerCase().includes(q)
                )
                if (!matchName && !matchTask) return false
            }
            if (onlyUnackFilter && item.unackCount === 0) {
                return false
            }
            return true
        })
        .sort((a, b) => {
            // Priority 1: Đội của người dùng (isMyTeam) luôn hiện đầu tiên
            if (a.isMyTeam && !b.isMyTeam) return -1
            if (!a.isMyTeam && b.isMyTeam) return 1

            // Priority 2: Đội có việc chưa tiếp nhận/cần xử lý lên trước
            if (a.unackCount > 0 && b.unackCount === 0) return -1
            if (a.unackCount === 0 && b.unackCount > 0) return 1

            // Priority 3: Đội có nhiều việc hơn lên trước
            if (b.total !== a.total) return b.total - a.total

            // Priority 4: Thứ tự chữ cái
            return a.teamName.localeCompare(b.teamName, 'vi')
        })

    return (
        <div className="space-y-6">
            {/* Top Overview Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-stone-900 via-stone-800 to-purple-950 text-white p-5 md:p-6 rounded-3xl shadow-lg">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-purple-200 text-xs font-semibold mb-2 backdrop-blur-sm">
                            <Users className="w-3.5 h-3.5" />
                            <span>Bảng điều phối & Bàn giao theo Đội</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black tracking-tight">
                            Tổng Quan Công Việc Các Đội Nhóm
                        </h2>
                        <p className="text-stone-300 text-xs md:text-sm mt-1 max-w-xl">
                            Mỗi khi có công việc mới được giao, đội đó sẽ hiển thị hộp số thông báo màu đỏ.
                            Khi bạn bấm xác nhận tiếp nhận, hộp số trên màn hình của bạn sẽ tự động biến mất.
                        </p>
                    </div>

                    {/* Status Alert Badge */}
                    <div className="flex items-center gap-3">
                        {totalMyUnackCount > 0 ? (
                            <div className="flex items-center gap-3 bg-rose-500/20 border border-rose-400/40 px-4 py-3 rounded-2xl backdrop-blur-md">
                                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-lg shadow-md animate-bounce flex-shrink-0">
                                    {totalMyUnackCount}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-rose-200 uppercase tracking-wider">Cần bạn nhận</div>
                                    <div className="text-sm font-black text-white">
                                        {totalMyUnackCount} việc chưa xác nhận
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 bg-emerald-500/20 border border-emerald-400/40 px-4 py-3 rounded-2xl backdrop-blur-md">
                                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-emerald-200 uppercase tracking-wider">Trạng thái</div>
                                    <div className="text-sm font-black text-white">
                                        Đã nhận hết công việc
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Subtle background glow */}
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute right-1/3 -top-10 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Controls: Search and Filter Toggle */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
                    <input
                        type="text"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Tìm đội hoặc công việc trong đội..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                        onClick={() => setOnlyUnackFilter(!onlyUnackFilter)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border ${
                            onlyUnackFilter
                                ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-500/20'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        }`}
                    >
                        <Bell className={`w-3.5 h-3.5 ${onlyUnackFilter ? 'text-rose-600' : 'text-stone-400'}`} />
                        <span>Chỉ hiện đội có việc cần nhận</span>
                        {totalMyUnackCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                                {totalMyUnackCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Teams Grid */}
            {filteredTeams.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center shadow-sm">
                    <Users className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-stone-700">
                        {onlyUnackFilter
                            ? '🎉 Không có đội nào có việc chưa tiếp nhận!'
                            : 'Không tìm thấy đội nào phù hợp'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                        {onlyUnackFilter
                            ? 'Tất cả các công việc được giao đều đã được bạn bấm xác nhận tiếp nhận.'
                            : 'Hãy thử tìm kiếm với từ khóa khác hoặc bỏ chọn bộ lọc.'}
                    </p>
                    {onlyUnackFilter && (
                        <button
                            onClick={() => setOnlyUnackFilter(false)}
                            className="mt-4 px-4 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition"
                        >
                            Xem tất cả các đội
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filteredTeams.map((item) => {
                        const hasUnack = item.unackCount > 0
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
                                className={`rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                    hasUnack
                                        ? 'bg-gradient-to-b from-rose-50/40 via-white to-white border-rose-300 ring-2 ring-rose-500/20'
                                        : 'bg-white border-stone-200 hover:border-purple-300'
                                }`}
                            >
                                {/* Card Header */}
                                <div className="p-4 border-b border-stone-100">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0 ${
                                                    hasUnack
                                                        ? 'bg-gradient-to-tr from-rose-500 to-amber-500 text-white shadow-rose-200'
                                                        : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-purple-200'
                                                }`}
                                            >
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="font-extrabold text-stone-900 text-base leading-tight">
                                                        Đội {item.teamName}
                                                    </h3>
                                                    {myTeamIds.includes(item.team.id) && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex-shrink-0">
                                                            ⭐ Đội của bạn
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] text-stone-500 font-medium">
                                                        Tổng: <b className="text-stone-800">{item.total}</b> việc
                                                    </span>
                                                    {item.inProgress > 0 && (
                                                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                                            {item.inProgress} đang làm
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* BOX SỐ THÔNG BÁO (Notification Box Badge) */}
                                        {item.isMyTeam ? (
                                            // Dành cho đội của người dùng hiện tại
                                            hasUnack ? (
                                                <div
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-xs shadow-md shadow-rose-200 ring-4 ring-rose-100 animate-pulse flex-shrink-0"
                                                    title={`${item.unackCount} việc mới chưa bấm xác nhận tiếp nhận`}
                                                >
                                                    <Bell className="w-3.5 h-3.5" />
                                                    <span>{item.unackCount} việc mới</span>
                                                </div>
                                            ) : item.total > 0 ? (
                                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex-shrink-0">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span>Đã nhận hết</span>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-stone-400 px-2 py-0.5 rounded bg-stone-50 border border-stone-100">
                                                    Chưa có việc
                                                </div>
                                            )
                                        ) : (
                                            // Dành cho các đội khác (không hiện box số cảnh báo cam giục nhận việc)
                                            item.teamUnackCount > 0 ? (
                                                <div className="text-[11px] font-medium text-stone-400 px-2.5 py-1 rounded-xl bg-stone-50 border border-stone-100 flex-shrink-0">
                                                    Chờ đội nhận
                                                </div>
                                            ) : item.total > 0 ? (
                                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex-shrink-0">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span>Đội đã nhận</span>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-stone-400 px-2 py-0.5 rounded bg-stone-50 border border-stone-100">
                                                    Chưa có việc
                                                </div>
                                            )
                                        )}
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
                                                    ? 'bg-white text-stone-900 shadow-xs'
                                                    : 'text-stone-600 hover:text-stone-900'
                                            }`}
                                        >
                                            <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                            <span>Mới nhất</span>
                                        </button>

                                        {/* 2. Chờ xác nhận */}
                                        <button
                                            type="button"
                                            onClick={() => setTeamStage(item.team.id, 'waiting_ack')}
                                            className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                currentStage === 'waiting_ack'
                                                    ? 'bg-white text-rose-700 shadow-xs'
                                                    : 'text-stone-600 hover:text-rose-700'
                                            }`}
                                        >
                                            <span>Chờ nhận</span>
                                            {item.isMyTeam && item.waitingAckTasks.length > 0 && (
                                                <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                                    currentStage === 'waiting_ack'
                                                        ? 'bg-rose-600 text-white'
                                                        : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                    {item.waitingAckTasks.length}
                                                </span>
                                            )}
                                        </button>

                                        {/* 3. Đã xác nhận */}
                                        <button
                                            type="button"
                                            onClick={() => setTeamStage(item.team.id, 'acknowledged')}
                                            className={`py-1.5 px-0.5 rounded-lg transition flex items-center justify-center gap-1 ${
                                                currentStage === 'acknowledged'
                                                    ? 'bg-white text-blue-700 shadow-xs'
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
                                                    ? 'bg-white text-emerald-700 shadow-xs'
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

                                {/* Card Body: Hiển thị danh sách việc theo tab stage đã chọn */}
                                <div className="p-4 flex-1 space-y-2.5">
                                    {displayedTasks.length === 0 ? (
                                        <div className="py-8 text-center text-stone-400">
                                            {currentStage === 'waiting_ack' && (
                                                <div className="space-y-1">
                                                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                                                    <p className="text-xs font-semibold text-emerald-700">Tuyệt vời! Không có việc nào chờ tiếp nhận</p>
                                                    <p className="text-[11px] text-stone-400">Tất cả thông báo đã được tiếp nhận đầy đủ</p>
                                                </div>
                                            )}
                                            {currentStage === 'acknowledged' && (
                                                <p className="text-xs font-medium">Chưa có công việc nào đang xử lý trong mục này</p>
                                            )}
                                            {currentStage === 'completed' && (
                                                <p className="text-xs font-medium">Chưa có công việc nào đã hoàn thành</p>
                                            )}
                                            {currentStage === 'latest' && (
                                                <p className="text-xs font-medium">Đội chưa có thông báo hoặc công việc nào</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {tasksToShow.map((task) => {
                                                const isUrgent = task.priority === 'urgent'
                                                const isImportant = task.priority === 'important'
                                                const isTaskAcknowledging = acknowledgingId === task.id
                                                const isTaskCompleted = task.status === 'completed'
                                                const isTaskPending = task.status === 'pending'
                                                const isTaskInProgress = task.status === 'in_progress'
                                                const isReminder = getTaskType(task) === 'reminder'
                                                const needsMyAck = (!isTaskCompleted || isReminder) && !hasUserAcknowledged(task, profile?.id, profile?.full_name) && item.isMyTeam

                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => onSelectTask(task)}
                                                        className={`p-3 rounded-xl bg-white border shadow-2xs hover:shadow transition cursor-pointer space-y-1.5 ${
                                                            isTaskCompleted
                                                                ? 'border-emerald-200 hover:border-emerald-300 bg-emerald-50/10'
                                                                : needsMyAck
                                                                ? 'border-rose-200 hover:border-rose-400'
                                                                : isTaskInProgress
                                                                ? 'border-blue-200 hover:border-blue-300'
                                                                : 'border-stone-200 hover:border-purple-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                                    <span className="font-mono text-[10px] font-bold text-stone-500 px-1.5 py-0.5 bg-stone-100 rounded">
                                                                        #{task.code}
                                                                    </span>

                                                                    {/* Stage Badge */}
                                                                    {isTaskCompleted ? (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                            Đã xong
                                                                        </span>
                                                                    ) : needsMyAck ? (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                                                                            Chờ bạn nhận
                                                                        </span>
                                                                    ) : isTaskInProgress ? (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                                                            Đang làm
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                                            Chờ đội nhận
                                                                        </span>
                                                                    )}

                                                                    {isUrgent && (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                                                                            Khẩn cấp
                                                                        </span>
                                                                    )}
                                                                    {isImportant && (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                                            Quan trọng
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <h4 className="text-xs font-bold text-stone-900 line-clamp-1 hover:text-purple-700">
                                                                    {task.title}
                                                                </h4>
                                                                <p className="text-[11px] text-stone-500 mt-0.5 flex items-center gap-1">
                                                                    <span>Giao bởi {task.created_by_name || 'Nhân viên'}</span>
                                                                    <span>•</span>
                                                                    <span>{formatDateRelative(task.created_at)}</span>
                                                                </p>
                                                            </div>

                                                            {/* Nút hành động */}
                                                            {needsMyAck ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleAcknowledgeClick(e, task)}
                                                                    disabled={isTaskAcknowledging}
                                                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1.5 transition flex-shrink-0 disabled:opacity-50"
                                                                    title="Bấm để xác nhận tiếp nhận công việc này"
                                                                >
                                                                    {isTaskAcknowledging ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>Xác nhận</span>
                                                                </button>
                                                            ) : !isTaskCompleted && (
                                                                <ChevronRight className="w-4 h-4 text-stone-300 mt-2 flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {currentStage === 'latest' && item.total > 1 && (
                                                <div className="text-center pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => onFilterByTeam(item.teamName.startsWith('Đội ') ? item.teamName : `Đội ${item.teamName}`)}
                                                        className="text-xs text-purple-700 font-bold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <span>+{item.total - 1} việc khác của đội...</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {currentStage !== 'latest' && displayedTasks.length > 3 && (
                                                <div className="text-center pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => onFilterByTeam(item.teamName.startsWith('Đội ') ? item.teamName : `Đội ${item.teamName}`)}
                                                        className="text-xs text-purple-700 font-bold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <span>+{displayedTasks.length - 3} việc khác trong mục này...</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer: Quick Actions */}
                                <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onCreateTaskForTeam(item.teamName.startsWith('Đội ') ? item.teamName : `Đội ${item.teamName}`)}
                                        className="text-xs font-bold text-stone-700 hover:text-purple-700 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white transition"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Giao việc mới</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onFilterByTeam(item.teamName.startsWith('Đội ') ? item.teamName : `Đội ${item.teamName}`)}
                                        className="text-xs font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-100/60 hover:bg-purple-100 transition"
                                    >
                                        <span>Xem danh sách ({item.total})</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {/* Generic / Shift-based tasks card if any exist */}
                    {genericTasks.length > 0 && (
                        <div
                            className={`rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                genericUnacknowledged.length > 0
                                    ? 'bg-gradient-to-b from-amber-50/40 via-white to-white border-amber-300 ring-2 ring-amber-500/20'
                                    : 'bg-white border-stone-200'
                            }`}
                        >
                            <div className="p-4 border-b border-stone-100">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center font-bold shadow-sm flex-shrink-0">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-900 text-base leading-tight">
                                                Ca trực & Khác
                                            </h3>
                                            <div className="text-[11px] text-stone-500 font-medium mt-0.5">
                                                Tổng: <b className="text-stone-800">{genericTasks.length}</b> việc giao theo ca
                                            </div>
                                        </div>
                                    </div>

                                    {genericUnacknowledged.length > 0 ? (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 text-white font-black text-xs shadow-md ring-4 ring-amber-100 animate-pulse">
                                            <Bell className="w-3.5 h-3.5" />
                                            <span>{genericUnacknowledged.length} việc mới</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span>Đã nhận hết</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 flex-1 space-y-3">
                                {genericUnacknowledged.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-amber-800">
                                            Cần bạn bấm xác nhận tiếp nhận:
                                        </div>
                                        {genericUnacknowledged.slice(0, 3).map((task) => (
                                            <div
                                                key={task.id}
                                                onClick={() => onSelectTask(task)}
                                                className="p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 shadow-sm transition cursor-pointer flex items-start justify-between gap-2"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-stone-900 truncate">
                                                        {task.title}
                                                    </div>
                                                    <div className="text-[11px] text-stone-500 mt-0.5">
                                                        #{task.code} • {formatDateRelative(task.created_at)}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleAcknowledgeClick(e, task)}
                                                    disabled={acknowledgingId === task.id}
                                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1 flex-shrink-0"
                                                >
                                                    {acknowledgingId === task.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Check className="w-3 h-3" />
                                                    )}
                                                    <span>Xác nhận</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-stone-400 text-xs">
                                        Tất cả việc theo ca đã được xác nhận tiếp nhận
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={() => onFilterByTeam('all')}
                                    className="text-xs font-bold text-amber-800 hover:text-amber-900 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100/60 hover:bg-amber-100 transition"
                                >
                                    <span>Xem tất cả ({genericTasks.length})</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
