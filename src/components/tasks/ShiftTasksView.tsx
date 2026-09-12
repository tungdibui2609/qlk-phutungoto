'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    CheckSquare,
    Plus,
    Search,
    RefreshCw,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Filter,
    User,
    Users,
    Calendar,
    MessageSquare,
    Image as ImageIcon,
    ShieldCheck,
    UserCheck,
    Check,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Flame,
    ArrowUpDown,
    Pencil,
    Trash2,
    LayoutGrid,
    Bell,
    Smartphone,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { ShiftTask, TaskStatus, TaskPriority } from './types'
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
    isUserAdmin,
    getTeamMemberAckInfo,
    getDeduplicatedAcknowledgements
} from './taskUtils'
import { formatTaskContentPreview, getCardContentPreview, extractInlineImageUrls } from './taskContentUtils'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import CreateTaskModal from './CreateTaskModal'
import TaskDetailModal from './TaskDetailModal'
import EditTaskModal from './EditTaskModal'
import CompleteTaskModal from './CompleteTaskModal'
import ImageLightbox from './ImageLightbox'
import TeamsOverview from './TeamsOverview'
import MobileShiftTasksView from './MobileShiftTasksView'
import TaskConfirmModal from './TaskConfirmModal'

interface ShiftTasksViewProps {
    isSanxuat?: boolean
}

export default function ShiftTasksView({ isSanxuat = false }: ShiftTasksViewProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const [tasks, setTasks] = useState<ShiftTask[]>([])
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([])
    const [myTeamIds, setMyTeamIds] = useState<string[]>([])
    const [allMembers, setAllMembers] = useState<{ id: string; team_id: string | null; user_id: string | null; full_name: string | null }[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    // Active Main Tab: 'overview' (Tổng quan theo Đội) or 'tasks' (Danh sách việc chi tiết)
    const [activeMainTab, setActiveMainTab] = useState<'overview' | 'tasks'>('overview')
    const [createForTeam, setCreateForTeam] = useState<string | undefined>(undefined)

    // Filter states
    const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
    const [shiftFilter, setShiftFilter] = useState<string>('all')
    const [priorityFilter, setPriorityFilter] = useState<string>('all')
    const [myTasksFilter, setMyTasksFilter] = useState<'all' | 'assigned_to_me' | 'created_by_me'>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Total unacknowledged tasks for the current logged-in user
    const totalMyUnacknowledged = useMemo(() => {
        return tasks.filter(t => {
            const isReminder = getTaskType(t) === 'reminder'
            if (isReminder) {
                return !hasUserAcknowledged(t, profile?.id, profile?.full_name)
            }
            return t.status !== 'completed' && !hasUserAcknowledged(t, profile?.id, profile?.full_name)
        }).length
    }, [tasks, profile?.id, profile?.full_name])

    // Current user team names
    const myTeamNames = useMemo(() => {
        return teams
            .filter(t => myTeamIds.includes(t.id))
            .map(t => t.name)
    }, [teams, myTeamIds])

    // Push Notifications & App Badge Manager
    const { updateAppBadge } = usePushNotifications({
        userId: profile?.id,
        userName: profile?.full_name,
        teamNames: myTeamNames,
        systemCode: currentSystem?.code,
        companyId: currentSystem?.company_id || profile?.company_id,
    })

    // Automatically synchronize App Badge (red dot / counter on phone icon)
    useEffect(() => {
        updateAppBadge(totalMyUnacknowledged)
    }, [totalMyUnacknowledged, updateAppBadge])

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [selectedTask, setSelectedTask] = useState<ShiftTask | null>(null)
    const [taskToComplete, setTaskToComplete] = useState<ShiftTask | null>(null)
    const [taskToEdit, setTaskToEdit] = useState<ShiftTask | null>(null)

    // Lightbox for card image click
    const [lightboxImages, setLightboxImages] = useState<string[]>([])
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [showLightbox, setShowLightbox] = useState(false)

    // Responsive Mobile Detection & View Mode Switcher
    const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false)
    const [viewMode, setViewMode] = useState<'auto' | 'mobile' | 'desktop'>('auto')

    useEffect(() => {
        const check = () => {
            if (typeof window !== 'undefined') {
                setIsMobileScreen(window.innerWidth < 768)
            }
        }
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    const isMobileView = viewMode === 'mobile' || (viewMode === 'auto' && isMobileScreen)

    const loadTasks = useCallback(async (isRefresh = false) => {
        if (!currentSystem) return
        if (isRefresh) setRefreshing(true)
        else setLoading(true)

        try {
            const companyId = currentSystem.company_id || profile?.company_id
            let query = (supabase as any)
                .from('shift_tasks')
                .select('*')
                .eq('system_code', currentSystem.code)
                .order('created_at', { ascending: false })

            if (companyId) {
                query = query.eq('company_id', companyId)
            }

            const { data, error } = await query
            if (error) throw error
            setTasks(data || [])
        } catch (err) {
            console.error('Error loading shift tasks:', err)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [currentSystem, profile])

    useEffect(() => {
        loadTasks()
    }, [loadTasks])

    // Load teams from construction_teams for filter
    useEffect(() => {
        const loadTeams = async () => {
            const companyId = currentSystem?.company_id || profile?.company_id
            if (!companyId && !currentSystem?.code) return
            try {
                let query = (supabase as any).from('construction_teams').select('id, name')
                if (currentSystem?.code) query = query.eq('system_code', currentSystem.code)
                if (companyId) query = query.eq('company_id', companyId)

                const { data } = await query.order('name', { ascending: true })
                if (data) {
                    const seen = new Set<string>()
                    const uniq: { id: string; name: string }[] = []
                    for (const t of data) {
                        const n = (t.name || '').trim()
                        if (n && !seen.has(n.toLowerCase())) {
                            seen.add(n.toLowerCase())
                            uniq.push({ id: t.id, name: n })
                        }
                    }
                    setTeams(uniq)
                }
            } catch (err) {
                console.error('Error loading teams for filter:', err)
            }
        }
        loadTeams()
    }, [currentSystem, profile])

    // Load all construction members and determine which teams current user belongs to
    useEffect(() => {
        const loadMembersAndMyTeams = async () => {
            try {
                const { data } = await (supabase as any)
                    .from('construction_members')
                    .select('id, team_id, user_id, full_name')

                if (data) {
                    setAllMembers(data)
                    if (profile?.id || profile?.full_name) {
                        const myMembers = data.filter((m: any) =>
                            (profile?.id && m.user_id === profile.id) ||
                            (profile?.full_name && m.full_name?.trim().toLowerCase() === profile.full_name.trim().toLowerCase())
                        )
                        const ids: string[] = myMembers.map((m: any) => m.team_id).filter(Boolean)
                        setMyTeamIds(Array.from(new Set(ids)))
                    }
                }
            } catch (err) {
                console.error('Error fetching construction members:', err)
            }
        }
        loadMembersAndMyTeams()
    }, [profile])

    // Realtime subscription for shift_tasks
    useEffect(() => {
        if (!currentSystem) return

        const channel = supabase
            .channel('shift_tasks_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'shift_tasks',
                    filter: `system_code=eq.${currentSystem.code}`,
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const rawNew = payload.new as ShiftTask
                        setTasks(prev => [rawNew, ...prev.filter(t => t.id !== rawNew.id)])
                        try {
                            const { data, error } = await (supabase as any)
                                .from('shift_tasks')
                                .select('*')
                                .eq('id', rawNew.id)
                                .single()
                            if (!error && data) {
                                setTasks(prev => prev.map(t => t.id === data.id ? data : t))
                            }
                        } catch (e) {
                            console.error('Error fetching full task on insert:', e)
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        const rawUpdated = payload.new as ShiftTask
                        // Merge safely without erasing content or images
                        setTasks(prev => prev.map(t => {
                            if (t.id === rawUpdated.id) {
                                return {
                                    ...t,
                                    ...rawUpdated,
                                    content: rawUpdated.content ?? t.content,
                                    images: (rawUpdated.images && rawUpdated.images.length > 0) ? rawUpdated.images : t.images,
                                    target_shifts: (rawUpdated.target_shifts && rawUpdated.target_shifts.length > 0) ? rawUpdated.target_shifts : t.target_shifts,
                                }
                            }
                            return t
                        }))
                        setSelectedTask(prev => {
                            if (prev?.id === rawUpdated.id) {
                                return {
                                    ...prev,
                                    ...rawUpdated,
                                    content: rawUpdated.content ?? prev.content,
                                    images: (rawUpdated.images && rawUpdated.images.length > 0) ? rawUpdated.images : prev.images,
                                    target_shifts: (rawUpdated.target_shifts && rawUpdated.target_shifts.length > 0) ? rawUpdated.target_shifts : prev.target_shifts,
                                }
                            }
                            return prev
                        })

                        // In background, fetch pristine full row from DB
                        try {
                            const { data, error } = await (supabase as any)
                                .from('shift_tasks')
                                .select('*')
                                .eq('id', rawUpdated.id)
                                .single()
                            if (!error && data) {
                                setTasks(prev => prev.map(t => t.id === data.id ? data : t))
                                setSelectedTask(prev => prev?.id === data.id ? data : prev)
                            }
                        } catch (e) {
                            console.error('Error fetching full task on update:', e)
                        }
                    } else if (payload.eventType === 'DELETE') {
                        const deletedId = (payload.old as any).id
                        setTasks(prev => prev.filter(t => t.id !== deletedId))
                        setSelectedTask(prev => (prev?.id === deletedId ? null : prev))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem])

    // Stats calculations
    const stats = useMemo(() => {
        const pending = tasks.filter(t => t.status === 'pending').length
        const inProgress = tasks.filter(t => t.status === 'in_progress').length
        const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length

        // Completed today
        const todayStr = new Date().toDateString()
        const completedToday = tasks.filter(t => {
            if (t.status !== 'completed' || !t.completed_at) return false
            return new Date(t.completed_at).toDateString() === todayStr
        }).length

        return { pending, inProgress, urgent, completedToday }
    }, [tasks])

    // Filtered tasks
    const filteredTasks = useMemo(() => {
        const filtered = tasks.filter((t: ShiftTask) => {
            // Status filter
            if (statusFilter !== 'all') {
                const isReminder = getTaskType(t) === 'reminder'
                if (statusFilter === 'pending') {
                    if (isReminder) {
                        if (hasUserAcknowledged(t, profile?.id, profile?.full_name)) return false
                    } else if (t.status !== 'pending') {
                        return false
                    }
                } else if (statusFilter === 'completed') {
                    if (isReminder) {
                        if (!hasUserAcknowledged(t, profile?.id, profile?.full_name)) return false
                    } else if (t.status !== 'completed') {
                        return false
                    }
                } else if (t.status !== statusFilter) {
                    return false
                }
            }

            // Shift filter
            // Shift / Team filter
            if (shiftFilter !== 'all') {
                const rawTargetShift = (t as any)?.target_shift
                const taskShifts: string[] = Array.isArray(t.target_shifts) && t.target_shifts.length > 0
                    ? t.target_shifts
                    : (Array.isArray(rawTargetShift)
                        ? rawTargetShift
                        : (typeof rawTargetShift === 'string' ? rawTargetShift.split(',').map((s: string) => s.trim()).filter(Boolean) : []))

                const isBroadcast = taskShifts.some(s => {
                    const l = String(s || '').toLowerCase()
                    return l === 'toàn bộ' || l === 'toàn đội' || l === 'tất cả' || l === 'tất cả các đội'
                })

                if (!isBroadcast) {
                    if (shiftFilter === 'other') {
                        const hasStandardShift = taskShifts.some(s => ['Ca 1 (Sáng)', 'Ca 2 (Chiều)', 'Ca 3 (Đêm)', 'Ca tiếp theo', 'Toàn ca'].includes(s))
                        if (hasStandardShift) return false
                    } else {
                        const matches = taskShifts.some(s => {
                            const l = String(s || '').toLowerCase()
                            return l === shiftFilter.toLowerCase() || l.includes(shiftFilter.toLowerCase())
                        })
                        if (!matches && String(t.target_shift || '') !== shiftFilter) return false
                    }
                }
            }

            // Priority filter
            if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false

            // My tasks filter
            if (myTasksFilter === 'assigned_to_me' && t.assigned_to !== profile?.id) return false
            if (myTasksFilter === 'created_by_me' && t.created_by !== profile?.id) return false

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchCode = String(t.code || '').toLowerCase().includes(q)
                const matchTitle = String(t.title || '').toLowerCase().includes(q)
                const matchContent = String(t.content || '').toLowerCase().includes(q)
                const matchCreator = String(t.created_by_name || '').toLowerCase().includes(q)
                const matchAssignee = String(t.assigned_to_name || '').toLowerCase().includes(q)
                const matchAck = String(t.acknowledged_by_name || '').toLowerCase().includes(q)
                if (!matchCode && !matchTitle && !matchContent && !matchCreator && !matchAssignee && !matchAck) {
                    return false
                }
            }

            return true
        })

        // Sort: Công việc của đội người dùng (hoặc giao cho người dùng) luôn hiện đầu tiên!
        const myTeamNames = teams
            .filter(t => myTeamIds.includes(t.id))
            .map(t => t.name.toLowerCase().trim())

        return filtered.sort((a: ShiftTask, b: ShiftTask) => {
            const isAMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(a, name)) || a.assigned_to === profile?.id
            const isBMyTeam = myTeamNames.some(name => isTaskAssignedToTeam(b, name)) || b.assigned_to === profile?.id

            // Priority 1: Việc của đội người dùng lên trước
            if (isAMyTeam && !isBMyTeam) return -1
            if (!isAMyTeam && isBMyTeam) return 1

            // Priority 2: Việc chưa hoàn thành lên trước việc đã hoàn thành
            if (a.status !== 'completed' && b.status === 'completed') return -1
            if (a.status === 'completed' && b.status !== 'completed') return 1

            // Priority 3: Thời gian mới nhất lên trước
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })
    }, [tasks, statusFilter, shiftFilter, priorityFilter, myTasksFilter, searchQuery, profile?.id, myTeamIds, teams])

    // Phân trang 12 công việc / lời nhắc mỗi trang
    const [currentPage, setCurrentPage] = useState(1)
    const PAGE_SIZE = 12

    useEffect(() => {
        setCurrentPage(1)
    }, [statusFilter, shiftFilter, priorityFilter, myTasksFilter, searchQuery, activeMainTab])

    const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE) || 1

    const paginatedTasks = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE
        return filteredTasks.slice(start, start + PAGE_SIZE)
    }, [filteredTasks, currentPage])

    // Quick Acknowledge from card (hỗ trợ nhiều người tiếp nhận)
    const handleQuickAcknowledge = async (e: React.MouseEvent, task: ShiftTask) => {
        e.stopPropagation()
        try {
            const now = new Date().toISOString()
            const currentAcks: any[] = Array.isArray(task.acknowledgements) ? task.acknowledgements : []
            const myId = profile?.id
            const myName = (profile?.full_name || '').trim().toLowerCase()

            const alreadyAcked = currentAcks.some(a => 
                (myId && a.user_id && a.user_id === myId) || 
                (myName && a.user_name && a.user_name.trim().toLowerCase() === myName)
            )

            const myTeamNames = teams
                .filter(t => myTeamIds.includes(t.id))
                .map(t => t.name)

            const deduplicatedCurrent = currentAcks.filter((a, idx) => {
                const firstIdx = currentAcks.findIndex(x => 
                    (x.user_id && a.user_id && x.user_id === a.user_id) ||
                    (x.user_name && a.user_name && x.user_name.trim().toLowerCase() === a.user_name.trim().toLowerCase())
                )
                return firstIdx === idx
            })

            const updatedAcks = alreadyAcked
                ? deduplicatedCurrent
                : [
                    ...deduplicatedCurrent,
                    {
                        user_id: profile?.id || null,
                        user_name: profile?.full_name || 'Nhân viên tiếp nhận',
                        team_names: myTeamNames,
                        acknowledged_at: now,
                    }
                ]

            const isReminder = getTaskType(task) === 'reminder'
            let newStatus = task.status === 'pending' ? 'in_progress' : task.status
            let completedAt = task.completed_at
            let completedByName = task.completed_by_name

            if (isReminder) {
                const tempTask = { ...task, acknowledgements: updatedAcks }
                const progress = getTaskTeamProgress(tempTask, allMembers, teams)
                if (progress.assignedTeams.length > 0 && progress.completedCount >= progress.total) {
                    newStatus = 'completed'
                    completedAt = now
                    completedByName = 'Tất cả các đội đã tiếp nhận'
                } else if (task.status === 'completed') {
                    newStatus = 'completed'
                }
            }

            const payload: any = {
                status: newStatus,
                acknowledgements: updatedAcks,
                acknowledged_by: task.acknowledged_by || profile?.id || null,
                acknowledged_by_name: task.acknowledged_by_name || profile?.full_name || 'Nhân viên tiếp nhận',
                acknowledged_at: task.acknowledged_at || now,
            }
            if (completedAt) payload.completed_at = completedAt
            if (completedByName) payload.completed_by_name = completedByName

            const { data, error } = await (supabase as any)
                .from('shift_tasks')
                .update(payload)
                .eq('id', task.id)
                .select()
                .single()

            if (error) throw error
            setTasks(prev => prev.map(t => (t.id === data.id ? data : t)))
        } catch (err) {
            console.error('Error quick acknowledging:', err)
            alert('Không thể nhận việc. Vui lòng thử lại.')
        }
    }

    const handleSelectTask = async (task: ShiftTask) => {
        setSelectedTask(task)
        if (!task.content || !task.images || task.images.length === 0) {
            try {
                const { data, error } = await (supabase as any)
                    .from('shift_tasks')
                    .select('*')
                    .eq('id', task.id)
                    .single()
                if (!error && data) {
                    setSelectedTask(data)
                    setTasks(prev => prev.map(t => t.id === data.id ? data : t))
                }
            } catch (e) {
                console.error('Error hydrating task on select:', e)
            }
        }
    }

    const handleTaskCreated = (newTask: ShiftTask) => {
        setTasks(prev => [newTask, ...prev])
    }

    const handleTaskUpdated = (updatedTask: ShiftTask) => {
        setTasks(prev => prev.map(t => (t.id === updatedTask.id ? {
            ...t,
            ...updatedTask,
            content: updatedTask.content ?? t.content,
            images: (updatedTask.images && updatedTask.images.length > 0) ? updatedTask.images : t.images,
        } : t)))
        if (selectedTask?.id === updatedTask.id) {
            setSelectedTask(prev => prev ? {
                ...prev,
                ...updatedTask,
                content: updatedTask.content ?? prev.content,
                images: (updatedTask.images && updatedTask.images.length > 0) ? updatedTask.images : prev.images,
            } : updatedTask)
        }
    }

    const handleTaskDeleted = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        if (selectedTask?.id === taskId) {
            setSelectedTask(null)
        }
    }

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean
        title: string
        message?: string
        taskSnippet?: { code?: string; title?: string }
        confirmText?: string
        cancelText?: string
        variant?: 'danger' | 'warning' | 'info' | 'success'
        isDanger?: boolean
        hideCancel?: boolean
        onConfirm: () => void | Promise<void>
    }>({
        isOpen: false,
        title: '',
        onConfirm: () => {},
    })

    // Quick Delete from card (người tạo hoặc quản trị viên cấp 1, cấp 2)
    const handleQuickDelete = async (e: React.MouseEvent, task: ShiftTask) => {
        e.stopPropagation()
        const canDelete = canManageTask(task, profile)
        if (!canDelete) {
            setConfirmModal({
                isOpen: true,
                title: 'Không có quyền xóa',
                message: 'Chỉ người tạo hoặc Quản trị viên mới có quyền xóa mục này.',
                variant: 'warning',
                isDanger: false,
                hideCancel: true,
                confirmText: 'Đã hiểu',
                onConfirm: () => {},
            })
            return
        }

        const isReminder = getTaskType(task) === 'reminder'
        const typeLabel = isReminder ? 'lời nhắc' : 'công việc'

        setConfirmModal({
            isOpen: true,
            title: `Xác nhận xóa ${typeLabel}`,
            message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${typeLabel} này không?`,
            taskSnippet: {
                code: task.code,
                title: task.title,
            },
            variant: 'danger',
            isDanger: true,
            confirmText: 'Xóa vĩnh viễn',
            cancelText: 'Hủy bỏ',
            onConfirm: async () => {
                try {
                    const { error } = await (supabase as any)
                        .from('shift_tasks')
                        .delete()
                        .eq('id', task.id)

                    if (error) throw error
                    handleTaskDeleted(task.id)
                } catch (err) {
                    console.error('Error deleting task:', err)
                    setConfirmModal({
                        isOpen: true,
                        title: 'Không thể xóa',
                        message: 'Đã xảy ra lỗi khi xóa dữ liệu. Vui lòng kiểm tra lại kết nối mạng.',
                        variant: 'warning',
                        isDanger: false,
                        hideCancel: true,
                        confirmText: 'Đóng',
                        onConfirm: () => {},
                    })
                }
            },
        })
    }

    const handleOpenCardLightbox = (e: React.MouseEvent, imgs: string[], idx: number) => {
        e.stopPropagation()
        setLightboxImages(imgs)
        setLightboxIndex(idx)
        setShowLightbox(true)
    }

    if (isMobileView) {
        return (
            <>
                <MobileShiftTasksView
                    tasks={tasks}
                    teams={teams}
                    myTeamIds={myTeamIds}
                    allMembers={allMembers}
                    loading={loading}
                    refreshing={refreshing}
                    onRefresh={() => loadTasks(true)}
                    onCreateTask={(targetShift) => {
                        setCreateForTeam(targetShift)
                        setShowCreateModal(true)
                    }}
                    onSelectTask={handleSelectTask}
                    onQuickAcknowledge={handleQuickAcknowledge}
                    onQuickDelete={handleQuickDelete}
                    onOpenCompleteModal={(task) => setTaskToComplete(task)}
                    onOpenEditModal={(task) => setTaskToEdit(task)}
                    onImageClick={(images, index) => {
                        setLightboxImages(images)
                        setLightboxIndex(index)
                        setShowLightbox(true)
                    }}
                    currentSystem={currentSystem}
                    profile={profile}
                    isSanxuat={isSanxuat}
                    onSwitchToDesktop={() => setViewMode('desktop')}
                />

                {/* Modals for Mobile View */}
                <CreateTaskModal
                    isOpen={showCreateModal}
                    onClose={() => {
                        setShowCreateModal(false)
                        setCreateForTeam(undefined)
                    }}
                    onTaskCreated={handleTaskCreated}
                    defaultShift={createForTeam}
                />

                <TaskDetailModal
                    isOpen={Boolean(selectedTask)}
                    task={selectedTask}
                    myTeamNames={myTeamNames}
                    allMembers={allMembers}
                    teams={teams}
                    onClose={() => setSelectedTask(null)}
                    onTaskUpdated={handleTaskUpdated}
                    onTaskDeleted={handleTaskDeleted}
                    onOpenCompleteModal={(task) => {
                        setSelectedTask(null)
                        setTaskToComplete(task)
                    }}
                />

                <CompleteTaskModal
                    isOpen={Boolean(taskToComplete)}
                    task={taskToComplete}
                    myTeamNames={myTeamNames}
                    onClose={() => setTaskToComplete(null)}
                    onTaskCompleted={handleTaskUpdated}
                />

                <EditTaskModal
                    isOpen={Boolean(taskToEdit)}
                    task={taskToEdit}
                    onClose={() => setTaskToEdit(null)}
                    onTaskUpdated={handleTaskUpdated}
                />

                {showLightbox && (
                    <ImageLightbox
                        images={lightboxImages}
                        currentIndex={lightboxIndex}
                        onClose={() => setShowLightbox(false)}
                        onNavigate={(i) => setLightboxIndex(i)}
                    />
                )}

                {/* Custom Responsive Confirmation & Alert Modal */}
                <TaskConfirmModal
                    {...confirmModal}
                    onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                />
            </>
        )
    }

    return (
        <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                            <CheckSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-stone-800">
                                Sổ Giao Việc & Nhắc Nhở Bàn Giao Ca
                            </h1>
                            <p className="text-xs md:text-sm text-stone-500">
                                {isSanxuat ? 'Xưởng sản xuất' : 'Phân hệ kho'}: Ghi chú việc làm dở, kèm ảnh minh chứng và xác nhận tiếp nhận 2 bên rõ ràng
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Nút chuyển chế độ xem di động */}
                    <button
                        onClick={() => setViewMode('mobile')}
                        className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition flex items-center gap-1.5 text-xs font-semibold"
                        title="Chuyển sang giao diện di động"
                    >
                        <Smartphone className="w-4 h-4 text-purple-600" />
                        <span className="hidden sm:inline">Bản Di Động</span>
                    </button>

                    <button
                        onClick={() => loadTasks(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition flex items-center gap-1.5 text-xs font-semibold"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-600' : ''}`} />
                        <span className="hidden sm:inline">Làm mới</span>
                    </button>

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs md:text-sm font-bold shadow-lg shadow-amber-500/25 flex items-center gap-2 transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Giao Việc / Nhắc Nhở Ca</span>
                    </button>
                </div>
            </div>

            {/* KPI Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* 1. Cần tiếp nhận (Vàng) */}
                <div
                    onClick={() => {
                        setActiveMainTab('tasks')
                        setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm hover:shadow ${
                        activeMainTab === 'tasks' && statusFilter === 'pending'
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                            : 'bg-white border-stone-200 hover:border-amber-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Cần tiếp nhận</span>
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-extrabold text-amber-600">{stats.pending}</span>
                        <span className="text-xs text-stone-500 font-medium">việc dở dang</span>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1">Chờ ca sau bấm xác nhận tiếp nhận</p>
                </div>

                {/* 2. Đang thực hiện (Xanh dương) */}
                <div
                    onClick={() => {
                        setActiveMainTab('tasks')
                        setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm hover:shadow ${
                        activeMainTab === 'tasks' && statusFilter === 'in_progress'
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                            : 'bg-white border-stone-200 hover:border-blue-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Đang làm dở</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-extrabold text-blue-600">{stats.inProgress}</span>
                        <span className="text-xs text-stone-500 font-medium">đã tiếp nhận</span>
                    </div>
                    <p className="text-[11px] text-blue-700 mt-1">Ca sau đang tiếp tục xử lý</p>
                </div>

                {/* 3. Việc khẩn cấp (Đỏ) */}
                <div
                    onClick={() => {
                        setActiveMainTab('tasks')
                        setPriorityFilter(priorityFilter === 'urgent' ? 'all' : 'urgent')
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm hover:shadow ${
                        activeMainTab === 'tasks' && priorityFilter === 'urgent'
                            ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20'
                            : 'bg-white border-stone-200 hover:border-red-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Khẩn cấp</span>
                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                            <Flame className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-extrabold text-red-600">{stats.urgent}</span>
                        <span className="text-xs text-stone-500 font-medium">ưu tiên cao</span>
                    </div>
                    <p className="text-[11px] text-red-700 mt-1">Cần tập trung làm ngay đầu ca</p>
                </div>

                {/* 4. Hoàn thành hôm nay (Xanh lá) */}
                <div
                    onClick={() => {
                        setActiveMainTab('tasks')
                        setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition shadow-sm hover:shadow ${
                        activeMainTab === 'tasks' && statusFilter === 'completed'
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                            : 'bg-white border-stone-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Xong hôm nay</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl md:text-3xl font-extrabold text-emerald-600">{stats.completedToday}</span>
                        <span className="text-xs text-stone-500 font-medium">đã nghiệm thu</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1">Các việc đã xong trong ngày</p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm space-y-3">
                {/* Top: Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-100">
                    {/* 0. Tab Tổng quan */}
                    <button
                        onClick={() => setActiveMainTab('overview')}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                            activeMainTab === 'overview'
                                ? 'bg-purple-700 text-white shadow-sm'
                                : 'text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Tổng quan</span>
                        {totalMyUnacknowledged > 0 ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                                {totalMyUnacknowledged}
                            </span>
                        ) : (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeMainTab === 'overview' ? 'bg-white/20' : 'bg-stone-100 text-stone-600'}`}>
                                {teams.length}
                            </span>
                        )}
                    </button>

                    {/* 1. Tất cả (Mới nhất) */}
                    <button
                        onClick={() => {
                            setActiveMainTab('tasks')
                            setStatusFilter('all')
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                            activeMainTab === 'tasks' && statusFilter === 'all'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-600 hover:bg-stone-100'
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Tất cả (Mới nhất)</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                            {tasks.length}
                        </span>
                    </button>

                    {/* 2. Chờ xác nhận */}
                    <button
                        onClick={() => {
                            setActiveMainTab('tasks')
                            setStatusFilter('pending')
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                            activeMainTab === 'tasks' && statusFilter === 'pending'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-stone-600 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Chờ xác nhận</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeMainTab === 'tasks' && statusFilter === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                            {stats.pending}
                        </span>
                    </button>

                    {/* 3. Đã xác nhận */}
                    <button
                        onClick={() => {
                            setActiveMainTab('tasks')
                            setStatusFilter('in_progress')
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                            activeMainTab === 'tasks' && statusFilter === 'in_progress'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-stone-600 hover:bg-blue-50 hover:text-blue-700'
                        }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                        <span>Đã xác nhận</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeMainTab === 'tasks' && statusFilter === 'in_progress' ? 'bg-white/20' : 'bg-blue-100 text-blue-700'}`}>
                            {stats.inProgress}
                        </span>
                    </button>

                    {/* 4. Hoàn thành */}
                    <button
                        onClick={() => {
                            setActiveMainTab('tasks')
                            setStatusFilter('completed')
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                            activeMainTab === 'tasks' && statusFilter === 'completed'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Hoàn thành</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeMainTab === 'tasks' && statusFilter === 'completed' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>
                            {tasks.filter(t => t.status === 'completed').length}
                        </span>
                    </button>
                </div>

                {/* Bottom: Search & Detailed Dropdowns (Only in tasks mode) */}
                {activeMainTab === 'tasks' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                        {/* Search box */}
                        <div className="relative">
                            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm kiếm theo tiêu đề, người giao..."
                                className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                            />
                        </div>

                        {/* Filter by Team */}
                        <div>
                            <select
                                value={shiftFilter}
                                onChange={(e) => setShiftFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-stone-700 bg-white font-medium"
                            >
                                <option value="all">👥 Tất cả các Đội</option>
                                {teams.map(t => (
                                    <option key={t.id} value={`Đội ${t.name}`}>
                                        👥 Đội {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Filter by Priority */}
                        <div>
                            <select
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-stone-700 bg-white"
                            >
                                <option value="all">⚡ Mức độ: Tất cả</option>
                                <option value="urgent">🔴 Khẩn cấp</option>
                                <option value="important">🟡 Quan trọng</option>
                                <option value="normal">🟢 Bình thường</option>
                            </select>
                        </div>

                        {/* My Tasks filter */}
                        <div>
                            <select
                                value={myTasksFilter}
                                onChange={(e) => setMyTasksFilter(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-stone-700 bg-white"
                            >
                                <option value="all">👥 Mọi người</option>
                                <option value="assigned_to_me">👉 Việc giao cho tôi</option>
                                <option value="created_by_me">📤 Việc tôi đã giao</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Main Content Area: Overview vs Task Cards List */}
            {activeMainTab === 'overview' ? (
                <TeamsOverview
                    teams={teams}
                    tasks={tasks}
                    profile={profile}
                    myTeamIds={myTeamIds}
                    allMembers={allMembers}
                    onSelectTask={handleSelectTask}
                    onQuickAcknowledge={handleQuickAcknowledge}
                    onFilterByTeam={(teamName) => {
                        setShiftFilter(teamName)
                        setStatusFilter('all')
                        setActiveMainTab('tasks')
                    }}
                    onCreateTaskForTeam={(teamName) => {
                        setCreateForTeam(teamName)
                        setShowCreateModal(true)
                    }}
                />
            ) : loading ? (
                <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-sm">
                    <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-semibold text-stone-700">Đang tải danh sách việc và lời nhắc ca...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                        <CheckSquare className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-stone-800">Không tìm thấy lời nhắc việc nào</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                        {searchQuery || statusFilter !== 'all' || shiftFilter !== 'all' || priorityFilter !== 'all'
                            ? 'Không có việc nào khớp với bộ lọc hiện tại. Hãy thử chọn lại bộ lọc hoặc xóa từ khóa tìm kiếm.'
                            : 'Hiện tại chưa có công việc dở dang hay lời nhắc nào. Hãy nhấn nút bên dưới để tạo lời nhắc giao việc đầu tiên cho ca!'}
                    </p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/25 inline-flex items-center gap-2 transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Tạo việc / Lời nhắc ngay</span>
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedTasks.map((task: ShiftTask) => {
                        const isPending = task.status === 'pending'
                        const isInProgress = task.status === 'in_progress'
                        const isCompleted = task.status === 'completed'
                        const isReminder = getTaskType(task) === 'reminder'

                        const acks = getDeduplicatedAcknowledgements(task)
                        const hasMyAck = acks.some(a => 
                            (profile?.id && a.user_id && a.user_id === profile.id) || 
                            (profile?.full_name && a.user_name && a.user_name.trim().toLowerCase() === profile.full_name.trim().toLowerCase())
                        )
                        const isCreatorOrAdmin = canManageTask(task, profile)
                        const canAcknowledge = canUserAcknowledgeTask(task, profile, myTeamNames, allMembers, teams)

                        return (
                            <div
                                key={task.id}
                                onClick={() => handleSelectTask(task)}
                                className={`rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer group bg-white shadow-sm hover:shadow-md relative overflow-hidden ${
                                    isPending
                                        ? 'border-amber-200 hover:border-amber-400 bg-gradient-to-b from-amber-50/20 to-white'
                                        : isInProgress
                                        ? 'border-blue-200 hover:border-blue-400 bg-gradient-to-b from-blue-50/20 to-white'
                                        : 'border-stone-200 hover:border-stone-300 opacity-90 hover:opacity-100'
                                }`}
                            >
                                {/* Top Accent Bar */}
                                <div
                                    className={`absolute top-0 left-0 right-0 h-1.5 ${
                                        task.priority === 'urgent'
                                            ? 'bg-red-500'
                                            : isPending
                                            ? 'bg-amber-500'
                                            : isInProgress
                                            ? 'bg-blue-500'
                                            : 'bg-emerald-500'
                                    }`}
                                />

                                {/* Card Header */}
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2 pt-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-[11px] font-bold text-stone-500 px-2 py-0.5 rounded bg-stone-100">
                                                #{task.code}
                                            </span>
                                            {(() => {
                                                const tType = getTaskType(task)
                                                return (
                                                    <span
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                                            tType === 'reminder'
                                                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                : 'bg-blue-50 text-blue-800 border-blue-200'
                                                        }`}
                                                    >
                                                        <span>{tType === 'reminder' ? '🔔 Lời nhắc' : '📋 Công việc'}</span>
                                                    </span>
                                                )
                                            })()}
                                            {(() => {
                                                const rawTargetShift = (task as any)?.target_shift
                                                const shiftsList: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
                                                    ? task.target_shifts
                                                    : (Array.isArray(rawTargetShift)
                                                        ? rawTargetShift
                                                        : (typeof rawTargetShift === 'string' ? rawTargetShift.split(',').map((s: string) => s.trim()).filter(Boolean) : []))
                                                if (shiftsList.length === 0) return null
                                                return (
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        {shiftsList.slice(0, 2).map((shift: string, idx: number) => {
                                                            const isAll = shift === 'Toàn bộ' || shift === 'Toàn đội'
                                                            return (
                                                                <span
                                                                    key={idx}
                                                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                                                        isAll
                                                                            ? 'bg-purple-700 text-white border-purple-700'
                                                                            : shift.startsWith('Đội')
                                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                                            : 'bg-stone-100 text-stone-600 border-stone-200'
                                                                    }`}
                                                                >
                                                                    {isAll ? '🏢 Toàn bộ' : shift.startsWith('Đội') ? `👥 ${shift}` : `🎯 ${shift}`}
                                                                </span>
                                                            )
                                                        })}

                                                        {shiftsList.length > 2 && (
                                                            <span
                                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 cursor-default"
                                                                title={shiftsList.slice(2).join(', ')}
                                                            >
                                                                +{shiftsList.length - 2}
                                                            </span>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </div>

                                        {/* Status Badge & Creator Quick Actions */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {isPending && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                                    Chờ nhận
                                                </span>
                                            )}
                                            {isInProgress && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                    Đang làm
                                                </span>
                                            )}
                                            {isCompleted && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                    <Check className="w-3 h-3" />
                                                    Đã xong
                                                </span>
                                            )}

                                            {/* Creator & Admin Quick Edit & Delete */}
                                            {isCreatorOrAdmin && (
                                                <div className="flex items-center gap-0.5 pl-1 border-l border-stone-200">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setTaskToEdit(task)
                                                        }}
                                                        className="p-1 rounded-md text-stone-400 hover:text-amber-700 hover:bg-amber-50 transition"
                                                        title="Sửa lời nhắc / công việc"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleQuickDelete(e, task)}
                                                        className="p-1 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                                                        title="Xóa lời nhắc / công việc"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Priority badge if urgent */}
                                    {task.priority === 'urgent' && (
                                        <div className="mb-2">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 uppercase tracking-wide">
                                                <Flame className="w-3 h-3 text-red-600" />
                                                Khẩn cấp
                                            </span>
                                        </div>
                                    )}

                                    {/* Title */}
                                    <h3 className="font-bold text-stone-900 text-sm md:text-base line-clamp-2 group-hover:text-amber-700 transition leading-snug mb-2">
                                        {task.title}
                                    </h3>

                                    {/* Content preview */}
                                    {task.content && getCardContentPreview(task.content) && (
                                        <p className="text-xs text-stone-600 line-clamp-3 mb-3 leading-relaxed">
                                            {getCardContentPreview(task.content)}
                                        </p>
                                    )}

                                    {/* Image Thumbnails Row (hỗ trợ cả ảnh đính kèm và ảnh chèn inline) */}
                                    {(() => {
                                        const cardImages = (Array.isArray(task.images) && task.images.length > 0)
                                            ? task.images
                                            : extractInlineImageUrls(task.content)
                                        if (!cardImages || cardImages.length === 0) return null

                                        return (
                                            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                                                {cardImages.slice(0, 4).map((img, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={(e) => handleOpenCardLightbox(e, cardImages, idx)}
                                                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-stone-200 flex-shrink-0 bg-stone-100 hover:opacity-90 transition shadow-xs cursor-pointer"
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={img}
                                                            alt="Ảnh đính kèm"
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {idx === 3 && cardImages.length > 4 && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[10px] font-bold">
                                                                +{cardImages.length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })()}
                                </div>

                                {/* Card Footer & Actions */}
                                <div className="pt-3 border-t border-stone-100 mt-2 space-y-2.5">
                                    {/* Creator & Ack metadata */}
                                    <div className="flex items-center justify-between text-[11px] text-stone-500">
                                        <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                                            <User className="w-3 h-3 text-stone-400 flex-shrink-0" />
                                            <span className="truncate font-medium">{task.created_by_name || 'Hệ thống'}</span>
                                            {task.assigned_to_name && (
                                                <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5 flex-shrink-0" title={`Chỉ định riêng cho ${task.assigned_to_name}`}>
                                                    <UserCheck className="w-2.5 h-2.5" />
                                                    {task.assigned_to_name}
                                                </span>
                                            )}
                                            {Array.isArray(task.edit_history) && task.edit_history.length > 0 && (
                                                <span
                                                    className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-medium flex-shrink-0"
                                                    title={`Đã chỉnh sửa ${task.edit_history.length} lần`}
                                                >
                                                    Đã sửa
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-stone-400 flex-shrink-0">
                                            {formatDateRelative(task.created_at)}
                                        </span>
                                    </div>

                                    {/* Acknowledged info if present */}
                                    {acks.length > 0 && (
                                        <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1.5">
                                            <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
                                                <span className="flex items-center gap-1">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                                    Đã tiếp nhận ({acks.length}):
                                                </span>
                                                {hasMyAck && (
                                                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                        ✓ Bạn đã nhận
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {acks.map((ack, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="inline-flex items-center gap-1 text-[10px] font-medium bg-white text-stone-700 border border-blue-200/60 px-2 py-0.5 rounded-md shadow-2xs"
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                        <span className="font-semibold text-stone-800">{ack.user_name}</span>
                                                        <span className="text-[9px] text-stone-400">({formatDateRelative(ack.acknowledged_at)})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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
                                                                title={memberInfo.ackedMembers.length > 0 ? `Đã nhận: ${memberInfo.ackedMembers.map(m => m.user_name).join(', ')}` : 'Chưa ai nhận'}
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

                                    {/* Quick action buttons */}
                                    <div className="flex items-center gap-2 pt-1">
                                        {isPending && (
                                            canAcknowledge && !hasMyAck ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleQuickAcknowledge(e, task)}
                                                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Xác nhận tiếp nhận việc</span>
                                                </button>
                                            ) : (
                                                <div className="w-full py-1.5 px-3 rounded-xl bg-stone-50 border border-stone-200 text-stone-500 text-xs font-medium text-center">
                                                    Đang chờ các đội nhận việc
                                                </div>
                                            )
                                        )}

                                        {isInProgress && (
                                            <>
                                                {!hasMyAck && canAcknowledge && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleQuickAcknowledge(e, task)}
                                                        className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1 transition active:scale-[0.99] whitespace-nowrap flex-shrink-0"
                                                        title="Ghi nhận bạn cũng tiếp nhận việc này"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        <span>Tôi cũng nhận</span>
                                                    </button>
                                                )}
                                                {(() => {
                                                    const completionInfo = canUserCompleteTeamTask(task, profile, myTeamNames)
                                                    if (completionInfo.canComplete) {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setTaskToComplete(task)
                                                                }}
                                                                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition active:scale-[0.99]"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                <span>
                                                                    {completionInfo.eligibleTeams.length === 1
                                                                        ? `Báo hoàn thành (${completionInfo.eligibleTeams[0].replace(/^Đội\s+/, '')})`
                                                                        : 'Đánh dấu hoàn thành'}
                                                                </span>
                                                            </button>
                                                        )
                                                    }
                                                    if (completionInfo.alreadyCompletedTeams.length > 0) {
                                                        return (
                                                            <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                                <span>Đội bạn đã hoàn thành</span>
                                                            </div>
                                                        )
                                                    }
                                                    if (task.assigned_to_name && !isReminder) {
                                                        return (
                                                            <div className="w-full py-1.5 px-3 rounded-xl bg-blue-50/70 border border-blue-200/60 text-blue-800 text-[11px] font-medium flex items-center justify-center gap-1 text-center truncate" title={`Công việc được chỉ định riêng cho ${task.assigned_to_name} báo cáo`}>
                                                                <UserCheck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                                                <span className="truncate">Chỉ định: <strong>{task.assigned_to_name}</strong> báo cáo</span>
                                                            </div>
                                                        )
                                                    }
                                                    return (
                                                        <div className="w-full py-1.5 px-3 text-stone-400 text-xs text-center italic">
                                                            Chờ các đội thực hiện
                                                        </div>
                                                    )
                                                })()}
                                            </>
                                        )}

                                        {isCompleted && (
                                            <div className="w-full py-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Hoàn tất {task.completed_at ? formatDateRelative(task.completed_at) : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Pagination Controls */}
                {filteredTasks.length > PAGE_SIZE && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 px-1 border-t border-stone-200">
                        <div className="text-xs text-stone-500 font-medium">
                            Hiển thị <b className="text-stone-800">{(currentPage - 1) * PAGE_SIZE + 1}</b> - <b className="text-stone-800">{Math.min(currentPage * PAGE_SIZE, filteredTasks.length)}</b> trên tổng số <b className="text-stone-800">{filteredTasks.length}</b> việc
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-2xs"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Trang trước</span>
                            </button>

                            <div className="flex items-center gap-1 px-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(page => {
                                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1
                                    })
                                    .map((page, idx, arr) => {
                                        const prevPage = arr[idx - 1]
                                        const hasGap = prevPage && page - prevPage > 1

                                        return (
                                            <React.Fragment key={page}>
                                                {hasGap && <span className="px-1 text-stone-400 text-xs">...</span>}
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-8 h-8 rounded-xl text-xs font-bold transition shadow-2xs ${
                                                        currentPage === page
                                                            ? 'bg-stone-900 text-white shadow-sm'
                                                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                                                    }`}
                                                >
                                                    {page}
                                                </button>
                                            </React.Fragment>
                                        )
                                    })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition shadow-2xs"
                            >
                                <span>Trang sau</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )}

            {/* Modals */}
            <CreateTaskModal
                isOpen={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false)
                    setCreateForTeam(undefined)
                }}
                onTaskCreated={handleTaskCreated}
                defaultShift={createForTeam || (shiftFilter !== 'all' && shiftFilter.startsWith('Đội') ? shiftFilter : undefined)}
            />

            <TaskDetailModal
                isOpen={!!selectedTask}
                task={selectedTask}
                myTeamNames={myTeamNames}
                allMembers={allMembers}
                teams={teams}
                onClose={() => setSelectedTask(null)}
                onTaskUpdated={handleTaskUpdated}
                onTaskDeleted={handleTaskDeleted}
                onOpenCompleteModal={(task) => {
                    setSelectedTask(null)
                    setTaskToComplete(task)
                }}
            />

            <CompleteTaskModal
                isOpen={!!taskToComplete}
                task={taskToComplete}
                myTeamNames={myTeamNames}
                onClose={() => setTaskToComplete(null)}
                onTaskCompleted={handleTaskUpdated}
            />

            <EditTaskModal
                isOpen={!!taskToEdit}
                task={taskToEdit}
                onClose={() => setTaskToEdit(null)}
                onTaskUpdated={handleTaskUpdated}
            />

            {/* Lightbox for direct card image preview */}
            {showLightbox && (
                <ImageLightbox
                    images={lightboxImages}
                    currentIndex={lightboxIndex}
                    onClose={() => setShowLightbox(false)}
                    onNavigate={(i) => setLightboxIndex(i)}
                />
            )}

            {/* Custom Responsive Confirmation & Alert Modal */}
            <TaskConfirmModal
                {...confirmModal}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    )
}
