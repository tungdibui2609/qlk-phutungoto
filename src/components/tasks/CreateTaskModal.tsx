'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Image as ImageIcon, Loader2, AlertTriangle, Check, User, Users, Clock, Bell, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { ShiftTask, TaskPriority, TaskType } from './types'
import { uploadTaskImage, generateTaskCode } from './taskUtils'
import TaskContentEditor from './TaskContentEditor'
import { extractInlineImageUrls, formatTaskContentPreview } from './taskContentUtils'

interface CreateTaskModalProps {
    isOpen: boolean
    onClose: () => void
    onTaskCreated: (newTask: ShiftTask) => void
    defaultShift?: string
}

interface UserOption {
    id: string
    full_name: string
    employee_code: string | null
}

interface TeamOption {
    id: string
    name: string
    code: string | null
}

export default function CreateTaskModal({ isOpen, onClose, onTaskCreated, defaultShift }: CreateTaskModalProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const [taskType, setTaskType] = useState<TaskType>('reminder')
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [priority, setPriority] = useState<TaskPriority>('normal')
    const [targetShifts, setTargetShifts] = useState<string[]>(
        defaultShift && defaultShift.startsWith('Đội') ? [defaultShift] : ['Toàn bộ']
    )
    const [assignedTo, setAssignedTo] = useState<string>('')
    const [users, setUsers] = useState<UserOption[]>([])
    const [teams, setTeams] = useState<TeamOption[]>([])

    // Toggle multi-team selection (hỗ trợ Toàn bộ gửi cho tất cả các đội)
    const toggleTargetShift = (teamName: string) => {
        if (teamName === 'Toàn bộ') {
            setTargetShifts(['Toàn bộ'])
            return
        }

        setTargetShifts(prev => {
            const withoutAll = prev.filter(s => s !== 'Toàn bộ')
            if (withoutAll.includes(teamName)) {
                const next = withoutAll.filter(s => s !== teamName)
                return next.length === 0 ? ['Toàn bộ'] : next
            } else {
                return [...withoutAll, teamName]
            }
        })
    }

    const selectAllTeams = () => {
        setTargetShifts(['Toàn bộ'])
    }

    const resetTeams = () => {
        setTargetShifts(['Toàn bộ'])
    }

    const [images, setImages] = useState<string[]>([])
    const [uploadingImage, setUploadingImage] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const prevIsOpenRef = useRef(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    // Reset form ONLY when modal transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            setTaskType('reminder')
            setTitle('')
            setContent('')
            setPriority('normal')
            const initialTeam = defaultShift && defaultShift.startsWith('Đội')
                ? [defaultShift]
                : ['Toàn bộ']
            setTargetShifts(initialTeam)
            setAssignedTo('')
            setImages([])
            setErrorMsg('')
        }
        prevIsOpenRef.current = isOpen
    }, [isOpen, defaultShift])



    // Load active users and teams in same company (does NOT reset form fields)
    useEffect(() => {
        if (!isOpen) return

        const loadUsersAndTeams = async () => {
            const companyId = currentSystem?.company_id || profile?.company_id
            if (!companyId && !currentSystem?.code) return

            try {
                // 1. Load users
                let userQuery = (supabase as any)
                    .from('user_profiles')
                    .select('id, full_name, employee_code')
                    .eq('is_active', true)
                    .order('full_name', { ascending: true })

                if (companyId) {
                    userQuery = userQuery.eq('company_id', companyId)
                }
                const { data: userData } = await userQuery
                setUsers(userData || [])

                // 2. Load teams from members-teams (construction_teams) theo đúng kho/phân hệ hiện tại
                let teamQuery = (supabase as any)
                    .from('construction_teams')
                    .select('id, name, code, system_code')

                if (currentSystem?.code) {
                    teamQuery = teamQuery.eq('system_code', currentSystem.code)
                }
                if (companyId) {
                    teamQuery = teamQuery.eq('company_id', companyId)
                }

                const { data: teamData } = await teamQuery.order('name', { ascending: true })
                if (teamData) {
                    // Deduplicate teams by trimmed name
                    const seen = new Set<string>()
                    const uniqueTeams: TeamOption[] = []
                    for (const t of teamData) {
                        const normalized = (t.name || '').trim()
                        if (normalized && !seen.has(normalized.toLowerCase())) {
                            seen.add(normalized.toLowerCase())
                            uniqueTeams.push({
                                id: t.id,
                                name: normalized,
                                code: t.code
                            })
                        }
                    }
                    setTeams(uniqueTeams)

                    // If targetShifts is empty, ensure it defaults to Toàn bộ
                    setTargetShifts(prev => {
                        if (prev.length === 0 || (prev.length === 1 && prev[0] === 'Ca tiếp theo')) {
                            const preferred = defaultShift && defaultShift.startsWith('Đội')
                                ? [defaultShift]
                                : ['Toàn bộ']
                            return preferred
                        }
                        return prev
                    })

                }
            } catch (err) {
                console.error('Error loading users or teams:', err)
            }
        }

        loadUsersAndTeams()
    }, [isOpen, currentSystem?.company_id, currentSystem?.code, profile?.company_id, defaultShift])

    if (!isOpen) return null

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadingImage(true)
        setErrorMsg('')
        try {
            const uploadedUrls: string[] = []
            for (let i = 0; i < files.length; i++) {
                const url = await uploadTaskImage(files[i])
                uploadedUrls.push(url)
            }
            setImages(prev => [...prev, ...uploadedUrls])
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi khi xử lý hình ảnh')
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
            if (cameraInputRef.current) cameraInputRef.current.value = ''
        }
    }

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            setErrorMsg(taskType === 'reminder' ? 'Vui lòng nhập tiêu đề lời nhắc / cảnh báo' : 'Vui lòng nhập tiêu đề công việc cần làm')
            return
        }
        if (!currentSystem) {
            setErrorMsg('Vui lòng chọn hệ thống kho / sản xuất')
            return
        }

        if (targetShifts.length === 0) {
            setErrorMsg('Vui lòng chọn ít nhất một Đội nhận việc')
            return
        }

        const companyId = currentSystem.company_id || profile?.company_id || null
        const taskCode = generateTaskCode(taskType)
        const selectedUser = users.find(u => u.id === assignedTo)
        const effectiveShifts = targetShifts

        setSubmitting(true)
        setErrorMsg('')

        try {
            // Tự động gom cả ảnh chèn inline trong văn bản và ảnh đính kèm
            const inlineUrls = extractInlineImageUrls(content)
            const combinedImages = Array.from(new Set([...images, ...inlineUrls]))

            const newTaskPayload: any = {
                code: taskCode,
                system_code: currentSystem.code,
                company_id: companyId,
                task_type: taskType,
                title: title.trim(),
                content: content.trim() || null,
                priority,
                status: 'pending',
                target_shift: effectiveShifts.join(', '),
                target_shifts: effectiveShifts,
                assigned_to: assignedTo || null,
                assigned_to_name: selectedUser ? selectedUser.full_name : null,
                images: combinedImages,
                created_by: profile?.id || null,
                created_by_name: profile?.full_name || 'Nhân viên',
            }

            let insertedData: any = null
            const { data, error } = await (supabase as any)
                .from('shift_tasks')
                .insert([newTaskPayload])
                .select()
                .single()

            if (error) {
                // Fallback nếu database chưa có cột task_type (tránh crash người dùng)
                if (error.message && (error.message.includes('task_type') || error.code === 'PGRST204')) {
                    const fallbackPayload = { ...newTaskPayload }
                    delete fallbackPayload.task_type
                    const { data: retryData, error: retryError } = await (supabase as any)
                        .from('shift_tasks')
                        .insert([fallbackPayload])
                        .select()
                        .single()

                    if (retryError) throw retryError
                    insertedData = { ...retryData, task_type: taskType }
                } else {
                    throw error
                }
            } else {
                insertedData = data
            }

            // Asynchronously dispatch Web Push Notification to target teams
            const cleanPreview = formatTaskContentPreview(content.trim())
            const typeEmoji = taskType === 'reminder' ? '🔔 [LỜI NHẮC]' : '📋 [CÔNG VIỆC]'
            fetch('/api/notifications/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: priority === 'urgent' ? `🔥 [GẤP] #${taskCode} - ${title.trim()}` : `${typeEmoji} #${taskCode} - ${title.trim()}`,
                    body: `Giao cho: ${effectiveShifts.join(', ')}. ${cleanPreview || (taskType === 'reminder' ? 'Có lời nhắc mới cần xem.' : 'Có công việc mới cần tiếp nhận.')}`,
                    target_shifts: effectiveShifts,
                    task_id: insertedData.id,
                    url: '/work/tasks',
                    badgeCount: 1,
                }),
            }).catch(e => console.warn('Failed to dispatch push notification:', e))

            onTaskCreated(insertedData)
            onClose()
        } catch (err: any) {
            console.error('Error creating shift task:', err)
            setErrorMsg(err.message || 'Không thể tạo dữ liệu. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[94vh] flex flex-col border border-stone-200 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md transition ${
                                taskType === 'reminder'
                                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/20'
                                    : 'bg-gradient-to-br from-blue-600 to-indigo-600 shadow-blue-500/20'
                            }`}
                        >
                            {taskType === 'reminder' ? <Bell className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-stone-800">
                                {taskType === 'reminder' ? 'Tạo Lời Nhắc / Cảnh Báo Cho Ca' : 'Giao Công Việc Mới Cho Ca / Đội'}
                            </h2>
                            <p className="text-xs text-stone-500">
                                {taskType === 'reminder'
                                    ? 'Thông báo việc dở dang, cảnh báo kỹ thuật để ca sau lưu ý tiếp nhận'
                                    : 'Giao nhiệm vụ cụ thể cần triển khai và báo cáo kết quả thực hiện'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
                    {errorMsg && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* BƯỚC CHỌN: Lời nhắc / Cảnh báo vs Công việc phải làm */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                            Bước 1: Chọn hình thức thông tin <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* Option 1: Lời nhắc / Cảnh báo / Ghi chú */}
                            <button
                                type="button"
                                onClick={() => setTaskType('reminder')}
                                className={`p-3.5 rounded-2xl border-2 text-left transition relative flex items-start gap-3 ${
                                    taskType === 'reminder'
                                        ? 'border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-500/20'
                                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                                        taskType === 'reminder'
                                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                                            : 'bg-stone-100 text-stone-600'
                                    }`}
                                >
                                    🔔
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <h4 className="text-sm font-bold text-stone-900 leading-tight">
                                            Lời nhắc / Cảnh báo
                                        </h4>
                                        {taskType === 'reminder' && (
                                            <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                                        Ghi chú ca, lưu ý máy móc, việc dở dang. Chỉ cần đọc &amp; xác nhận đã biết.
                                    </p>
                                </div>
                            </button>

                            {/* Option 2: Công việc phải làm */}
                            <button
                                type="button"
                                onClick={() => setTaskType('task')}
                                className={`p-3.5 rounded-2xl border-2 text-left transition relative flex items-start gap-3 ${
                                    taskType === 'task'
                                        ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                                        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                                        taskType === 'task'
                                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'
                                            : 'bg-stone-100 text-stone-600'
                                    }`}
                                >
                                    📋
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                        <h4 className="text-sm font-bold text-stone-900 leading-tight">
                                            Công việc phải làm
                                        </h4>
                                        {taskType === 'task' && (
                                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                                        Giao nhiệm vụ cụ thể, yêu cầu đội/người nhận bắt tay vào làm và báo cáo hoàn thành.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Tiêu đề */}
                    <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            {taskType === 'reminder' ? 'Tiêu đề Lời nhắc / Cảnh báo' : 'Tiêu đề Công việc phải làm'}{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={
                                taskType === 'reminder'
                                    ? 'VD: Lô xoài sấy khay 3 đang đợi nguội, máy ép số 2 có tiếng kêu...'
                                    : 'VD: Đóng gói 50 thùng xoài xuất khẩu, kiểm kê kho bao bì...'
                            }
                            className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-stone-800 font-medium placeholder:text-stone-400 text-sm transition"
                            required
                        />
                    </div>

                    {/* Giao cho Đội nhận việc */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                                <span>Giao cho Đội nhận việc</span>
                                <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                                    {targetShifts.includes('Toàn bộ') ? 'Toàn bộ (Tất cả các đội)' : `${targetShifts.length} đội nhận việc`}
                                </span>
                            </label>
                            {teams.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllTeams}
                                        className="text-xs font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                                    >
                                        Chọn tất cả ({teams.length} đội)
                                    </button>
                                    {(!targetShifts.includes('Toàn bộ') || targetShifts.length > 1) && (
                                        <button
                                            type="button"
                                            onClick={resetTeams}
                                            className="text-xs text-stone-400 hover:text-stone-600"
                                        >
                                            Đặt lại
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Pills container & Picker */}
                        <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5">
                            {/* Selected Active Badges */}
                            <div className="flex flex-wrap gap-1.5 min-h-[32px] items-center">
                                {targetShifts.map((shift, idx) => {
                                    const isAll = shift === 'Toàn bộ'
                                    return (
                                        <span
                                            key={idx}
                                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-2xs transition ${
                                                isAll
                                                    ? 'bg-purple-700 text-white border-purple-700'
                                                    : 'bg-purple-100 text-purple-800 border-purple-200'
                                            }`}
                                        >
                                            <span>{isAll ? '🏢 Toàn bộ (Tất cả các đội)' : `👥 ${shift}`}</span>
                                            {targetShifts.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleTargetShift(shift)}
                                                    className="hover:bg-purple-200/80 rounded-full p-0.5 text-purple-600 hover:text-purple-900 transition"
                                                    title="Bỏ chọn"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </span>
                                    )
                                })}
                            </div>

                            {/* Danh sách các Đội có sẵn (Bấm để chọn / bỏ chọn nhiều đội) */}
                            <div className="pt-2 border-t border-stone-200/60">
                                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                                    Bấm để chọn Đội nhận việc (Mặc định: Toàn bộ):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {/* Nút Toàn bộ (Mặc định) */}
                                    <button
                                        type="button"
                                        onClick={() => toggleTargetShift('Toàn bộ')}
                                        className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                                            targetShifts.includes('Toàn bộ')
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold ring-2 ring-purple-300'
                                                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 font-medium'
                                        }`}
                                    >
                                        <span>{targetShifts.includes('Toàn bộ') ? '✓' : '+'}</span>
                                        <span>🏢 Toàn bộ (Tất cả các đội)</span>
                                    </button>

                                    {/* Các đội cụ thể */}
                                    {teams.map(t => {
                                        const teamName = `Đội ${t.name}`
                                        const isSelected = targetShifts.includes(teamName)
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => toggleTargetShift(teamName)}
                                                className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1.5 ${
                                                    isSelected
                                                        ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-semibold'
                                                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100 font-medium'
                                                }`}
                                            >
                                                <span>{isSelected ? '✓' : '+'}</span>
                                                <span>👥 Đội {t.name}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>



                    {/* Hàng: Mức độ ưu tiên & Người nhận cụ thể */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Mức độ ưu tiên */}
                        <div>
                            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                Mức độ ưu tiên
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPriority('normal')}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                                        priority === 'normal'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    Bình thường
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriority('important')}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                                        priority === 'important'
                                            ? 'bg-amber-50 text-amber-700 border-amber-300 ring-2 ring-amber-500/20 shadow-sm'
                                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    Quan trọng
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriority('urgent')}
                                    className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                                        priority === 'urgent'
                                            ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-500/20 shadow-sm'
                                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                    Khẩn cấp
                                </button>
                            </div>
                        </div>

                        {/* Chỉ định người nhận cụ thể (Tùy chọn) */}
                        <div>
                            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                Chỉ định người phụ trách chính <span className="text-stone-400 font-normal">(Tùy chọn)</span>
                            </label>
                            <div className="relative">
                                <select
                                    value={assignedTo}
                                    onChange={(e) => setAssignedTo(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 text-stone-800 text-sm appearance-none bg-white transition pr-10"
                                >
                                    <option value="">-- Để trống: Bất kỳ ai trong ca/đội đều có thể tiếp nhận --</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name} {u.employee_code ? `(${u.employee_code})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <User className="w-4 h-4 text-stone-400 absolute right-3.5 top-3 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {/* Nội dung chi tiết hỗ trợ chèn ảnh inline */}
                    <TaskContentEditor
                        label="Chi tiết công việc làm dở & Hướng dẫn cho ca sau"
                        value={content}
                        onChange={setContent}
                        rows={4}
                        placeholder="Mô tả cụ thể:
- Ca trước đã làm được gì? (VD: Đã dán tem 300/500 thùng)
- Hàng/máy móc đang ở vị trí nào? (Đặt con trỏ và bấm 'Chèn ảnh' hoặc dán Ctrl+V)
- Ca sau vào cần làm tiếp bước nào? (VD: Chờ sấy thêm 30p rồi đóng nắp...)"
                    />

                    {/* Đính kèm hình ảnh */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                                <ImageIcon className="w-4 h-4 text-amber-600" />
                                Hình ảnh minh chứng hiện trường
                            </label>
                            <span className="text-xs text-stone-400">
                                {images.length > 0 ? `${images.length} ảnh đã chọn` : 'Tối đa 6 ảnh'}
                            </span>
                        </div>

                        {/* Hidden file inputs */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            multiple
                            className="hidden"
                        />
                        <input
                            type="file"
                            ref={cameraInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                        />

                        {/* Image Preview & Upload buttons */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {images.map((imgUrl, index) => (
                                <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-50 shadow-sm">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={imgUrl}
                                        alt={`Ảnh ${index + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(index)}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center opacity-90 group-hover:opacity-100 hover:scale-110 shadow transition"
                                        title="Xóa ảnh"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}

                            {/* Nút Upload từ máy */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-400 hover:bg-amber-50/40 flex flex-col items-center justify-center text-stone-500 hover:text-amber-700 transition p-2 text-center group"
                            >
                                {uploadingImage ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                                ) : (
                                    <>
                                        <ImageIcon className="w-5 h-5 text-stone-400 group-hover:text-amber-600 mb-1 transition" />
                                        <span className="text-[11px] font-medium leading-tight">Thêm ảnh</span>
                                    </>
                                )}
                            </button>

                            {/* Nút Chụp ảnh trực tiếp */}
                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-amber-400 hover:bg-amber-50/40 flex flex-col items-center justify-center text-stone-500 hover:text-amber-700 transition p-2 text-center group"
                            >
                                <Camera className="w-5 h-5 text-stone-400 group-hover:text-amber-600 mb-1 transition" />
                                <span className="text-[11px] font-medium leading-tight">Chụp ảnh</span>
                            </button>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 text-sm font-semibold transition"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || uploadingImage}
                            className={`px-6 py-2.5 rounded-xl text-white text-sm font-semibold shadow-lg flex items-center gap-2 transition disabled:opacity-50 ${
                                taskType === 'reminder'
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25'
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{taskType === 'reminder' ? 'Tạo Lời Nhắc / Cảnh Báo' : 'Giao Công Việc Mới'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
