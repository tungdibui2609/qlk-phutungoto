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
    ArrowRight
} from 'lucide-react'
import { ShiftTask, TaskPriority } from './types'
import { formatDateTime, formatDateRelative, isTaskAssignedToTeam, hasUserAcknowledged, hasTeamAcknowledged } from './taskUtils'

interface TeamsOverviewProps {
    teams: { id: string; name: string }[]
    tasks: ShiftTask[]
    profile: any
    myTeamIds?: string[]
    allMembers?: { team_id: string | null; user_id: string | null; full_name: string | null }[]
    onSelectTask: (task: ShiftTask) => void
    onQuickAcknowledge: (e: React.MouseEvent, task: ShiftTask) => Promise<void>
    onFilterByTeam: (teamName: string) => void
    onCreateTaskForTeam: (teamName: string) => void
}

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
        const pendingTasks = teamTasks.filter((t) => t.status === 'pending')
        const inProgressTasks = teamTasks.filter((t) => t.status === 'in_progress')
        const completedTasks = teamTasks.filter((t) => t.status === 'completed')

        // Tasks that current user has NOT acknowledged yet
        const userUnackTasks = teamTasks.filter(
            (t) => t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
        )

        // Tasks that NO member of THIS team has acknowledged yet
        const teamUnackTasks = teamTasks.filter(
            (t) => t.status !== 'completed' && !hasTeamAcknowledged(t, team, allMembers)
        )

        // For my team: alert if I personally haven't acknowledged yet.
        // For other teams: alert if the team has not acknowledged yet.
        const unacknowledgedTasks = isMyTeam ? userUnackTasks : teamUnackTasks
        const unackCount = unacknowledgedTasks.length

        return {
            team,
            teamName: team.name,
            isMyTeam,
            total: teamTasks.length,
            pending: pendingTasks.length,
            inProgress: inProgressTasks.length,
            completed: completedTasks.length,
            unacknowledged: unacknowledgedTasks,
            unackCount,
            userUnackCount: userUnackTasks.length,
            teamUnackCount: teamUnackTasks.length,
            allTasks: teamTasks,
        }
    })

    // 2. Also check tasks not assigned to any registered team (e.g. Ca 1, Ca 2, Chung)
    const genericTasks = tasks.filter((t) => {
        return !teams.some((team) => isTaskAssignedToTeam(t, team.name))
    })

    const genericUnacknowledged = genericTasks.filter(
        (t) => t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
    )

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
                const q = teamSearch.toLowerCase()
                const matchName = item.teamName.toLowerCase().includes(q)
                const matchTask = item.allTasks.some(
                    (t) => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
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
                                            // Dành cho các đội khác (hiển thị xem đội đó đã tiếp nhận hay chưa)
                                            item.teamUnackCount > 0 ? (
                                                <div
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500 text-white font-bold text-[11px] shadow-sm flex-shrink-0"
                                                    title={`${item.teamUnackCount} việc chưa có thành viên đội này tiếp nhận`}
                                                >
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span>{item.teamUnackCount} việc chưa nhận</span>
                                                </div>
                                            ) : item.total > 0 ? (
                                                <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex-shrink-0">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span>Đội đã nhận hết</span>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-stone-400 px-2 py-0.5 rounded bg-stone-50 border border-stone-100">
                                                    Chưa có việc
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Card Body: Unacknowledged tasks needing attention */}
                                <div className="p-4 flex-1 space-y-3">
                                    {hasUnack ? (
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className={`font-bold flex items-center gap-1.5 ${item.isMyTeam ? 'text-rose-700' : 'text-amber-700'}`}>
                                                    <Flame className={`w-3.5 h-3.5 ${item.isMyTeam ? 'text-rose-500' : 'text-amber-500'}`} />
                                                    {item.isMyTeam ? 'Cần bạn bấm xác nhận tiếp nhận:' : 'Việc đội này chưa tiếp nhận:'}
                                                </span>
                                                <span className={`text-[11px] font-semibold ${item.isMyTeam ? 'text-rose-600' : 'text-amber-600'}`}>
                                                    {item.unackCount} việc
                                                </span>
                                            </div>

                                            {item.unacknowledged.slice(0, 3).map((task) => {
                                                const isUrgent = task.priority === 'urgent'
                                                const isImportant = task.priority === 'important'
                                                const isTaskAcknowledging = acknowledgingId === task.id

                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => onSelectTask(task)}
                                                        className="p-3 rounded-xl bg-white border border-rose-200 hover:border-rose-400 shadow-sm hover:shadow transition cursor-pointer space-y-2"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                                                    <span className="font-mono text-[10px] font-bold text-stone-500 px-1.5 py-0.5 bg-stone-100 rounded">
                                                                        #{task.code}
                                                                    </span>
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

                                                            {/* Action Button: Chỉ hiện nút nhận nhanh cho đội của mình hoặc quản trị */}
                                                            {item.isMyTeam || profile?.role === 'admin' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleAcknowledgeClick(e, task)}
                                                                    disabled={isTaskAcknowledging}
                                                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm inline-flex items-center gap-1.5 transition flex-shrink-0 disabled:opacity-50"
                                                                    title="Xác nhận tiếp nhận công việc này"
                                                                >
                                                                    {isTaskAcknowledging ? (
                                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    )}
                                                                    <span>Xác nhận</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg flex-shrink-0">
                                                                    Chờ đội nhận
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}

                                            {item.unackCount > 3 && (
                                                <div className="text-center pt-1">
                                                    <button
                                                        onClick={() => onFilterByTeam(`Đội ${item.teamName}`)}
                                                        className="text-xs text-rose-700 font-bold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <span>+{item.unackCount - 3} việc cần nhận khác...</span>
                                                        <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : item.allTasks.length > 0 ? (
                                        <div className="space-y-2">
                                            <div className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                <span>Công việc gần đây của đội:</span>
                                            </div>
                                            {item.allTasks.slice(0, 2).map((task) => (
                                                <div
                                                    key={task.id}
                                                    onClick={() => onSelectTask(task)}
                                                    className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 hover:border-purple-300 hover:bg-white transition cursor-pointer flex items-center justify-between gap-2 text-xs"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-semibold text-stone-800 truncate">
                                                            {task.title}
                                                        </div>
                                                        <div className="text-[10px] text-stone-500 mt-0.5">
                                                            #{task.code} • {formatDateRelative(task.created_at)}
                                                        </div>
                                                    </div>
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                            task.status === 'completed'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-blue-100 text-blue-800'
                                                        }`}
                                                    >
                                                        {task.status === 'completed' ? 'Đã xong' : 'Đang làm'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-stone-400">
                                            <p className="text-xs font-medium">Đội chưa có lời nhắc việc nào</p>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer: Quick Actions */}
                                <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onCreateTaskForTeam(`Đội ${item.teamName}`)}
                                        className="text-xs font-bold text-stone-700 hover:text-purple-700 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-white transition"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Giao việc mới</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => onFilterByTeam(`Đội ${item.teamName}`)}
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
