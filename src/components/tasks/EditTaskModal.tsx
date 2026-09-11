'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Image as ImageIcon, Loader2, AlertTriangle, Check, User, Clock, Bell, History } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { ShiftTask, TaskPriority, TaskEditHistoryEntry } from './types'
import { uploadTaskImage } from './taskUtils'

interface EditTaskModalProps {
    isOpen: boolean
    task: ShiftTask | null
    onClose: () => void
    onTaskUpdated: (updatedTask: ShiftTask) => void
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

const PRIORITY_LABELS: Record<TaskPriority, string> = {
    normal: 'Bình thường',
    important: 'Quan trọng',
    urgent: 'Khẩn cấp',
}

export default function EditTaskModal({ isOpen, task, onClose, onTaskUpdated }: EditTaskModalProps) {
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [priority, setPriority] = useState<TaskPriority>('normal')
    const [targetShifts, setTargetShifts] = useState<string[]>(['Ca tiếp theo'])
    const [assignedTo, setAssignedTo] = useState<string>('')
    const [users, setUsers] = useState<UserOption[]>([])
    const [teams, setTeams] = useState<TeamOption[]>([])

    // Toggle multi-team or shift selection
    const toggleTargetShift = (shiftName: string) => {
        setTargetShifts(prev => {
            if (prev.includes(shiftName)) {
                const next = prev.filter(s => s !== shiftName)
                return next.length === 0 ? ['Ca tiếp theo'] : next
            } else {
                const filtered = prev.filter(s => s !== 'Ca tiếp theo')
                return [...filtered, shiftName]
            }
        })
    }

    const selectAllTeams = () => {
        if (teams.length === 0) return
        setTargetShifts(teams.map(t => `Đội ${t.name}`))
    }

    const clearTeams = () => {
        setTargetShifts(['Ca tiếp theo'])
    }

    const [images, setImages] = useState<string[]>([])
    const [uploadingImage, setUploadingImage] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    // Check if current user is creator
    const isCreator = Boolean(
        task &&
        (profile?.id === task.created_by ||
            (profile?.full_name && task.created_by_name === profile.full_name) ||
            profile?.role === 'admin')
    )

    // Load form data whenever task changes
    useEffect(() => {
        if (task && isOpen) {
            setTitle(task.title || '')
            setContent(task.content || '')
            setPriority(task.priority || 'normal')
            const initialShifts: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
                ? task.target_shifts
                : (task.target_shift ? task.target_shift.split(',').map(s => s.trim()).filter(Boolean) : ['Ca tiếp theo'])
            setTargetShifts(initialShifts.length > 0 ? initialShifts : ['Ca tiếp theo'])
            setAssignedTo(task.assigned_to || '')
            setImages(Array.isArray(task.images) ? [...task.images] : [])
            setErrorMsg('')
        }
    }, [task, isOpen])

    // Load active users and teams in same company & system
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
                }
            } catch (err) {
                console.error('Error loading users or teams:', err)
            }
        }

        loadUsersAndTeams()
    }, [currentSystem, profile, isOpen])

    if (!isOpen || !task) return null

    // Xử lý upload ảnh
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        const companyId = currentSystem?.company_id || profile?.company_id
        if (!companyId) {
            setErrorMsg('Không tìm thấy thông tin công ty.')
            return
        }

        setUploadingImage(true)
        setErrorMsg('')
        try {
            const uploadPromises = Array.from(files).map(file =>
                uploadTaskImage(file, companyId, 'task-images')
            )
            const uploadedUrls = await Promise.all(uploadPromises)
            const validUrls = uploadedUrls.filter((url): url is string => url !== null)
            setImages(prev => [...prev, ...validUrls])
        } catch (err) {
            console.error('Upload error:', err)
            setErrorMsg('Lỗi khi tải ảnh lên. Vui lòng thử lại.')
        } finally {
            setUploadingImage(false)
        }
    }

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) {
            setErrorMsg('Vui lòng nhập tiêu đề công việc / lời nhắc.')
            return
        }

        if (!isCreator) {
            setErrorMsg('Chỉ người tạo việc ban đầu mới có quyền chỉnh sửa.')
            return
        }

        setSubmitting(true)
        setErrorMsg('')

        try {
            // Xác định danh sách các thay đổi (changes)
            const changes: string[] = []
            const oldTitle = (task.title || '').trim()
            const newTitle = title.trim()
            if (oldTitle !== newTitle) {
                changes.push(`Tiêu đề: "${oldTitle}" → "${newTitle}"`)
            }

            const oldContent = (task.content || '').trim()
            const newContent = content.trim()
            if (oldContent !== newContent) {
                changes.push('Ghi chú nội dung đã được cập nhật')
            }

            if (task.priority !== priority) {
                changes.push(`Mức ưu tiên: ${PRIORITY_LABELS[task.priority] || task.priority} → ${PRIORITY_LABELS[priority] || priority}`)
            }

            const oldShifts: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
                ? task.target_shifts
                : (task.target_shift ? task.target_shift.split(',').map(s => s.trim()).filter(Boolean) : ['Ca tiếp theo'])
            const effectiveShifts = targetShifts.length > 0 ? targetShifts : ['Ca tiếp theo']
            const oldShiftsStr = oldShifts.join(', ')
            const newShiftsStr = effectiveShifts.join(', ')
            if (oldShiftsStr !== newShiftsStr) {
                changes.push(`Đối tượng giao: "${oldShiftsStr}" → "${newShiftsStr}"`)
            }

            const oldAssignedTo = task.assigned_to || ''
            if (oldAssignedTo !== assignedTo) {
                const newAssignee = users.find(u => u.id === assignedTo)
                changes.push(`Người phụ trách: ${newAssignee ? newAssignee.full_name : 'Bất kỳ ai trong ca'}`)
            }

            const oldImgCount = (task.images || []).length
            const newImgCount = images.length
            if (oldImgCount !== newImgCount || JSON.stringify(task.images || []) !== JSON.stringify(images)) {
                changes.push(`Ảnh minh chứng hiện trường: ${oldImgCount} ảnh → ${newImgCount} ảnh`)
            }

            if (changes.length === 0) {
                // Không có thay đổi nào
                onClose()
                return
            }

            const assignedUser = users.find(u => u.id === assignedTo)
            const now = new Date().toISOString()

            // Tạo entry mới cho lịch sử chỉnh sửa
            const historyEntry: TaskEditHistoryEntry = {
                edited_by: profile?.id || null,
                edited_by_name: profile?.full_name || 'Người tạo việc',
                edited_at: now,
                changes,
                previous_snapshot: {
                    title: task.title,
                    content: task.content,
                    priority: task.priority,
                    target_shift: task.target_shift,
                    images: task.images || []
                }
            }

            const currentHistory = Array.isArray(task.edit_history) ? task.edit_history : []
            const updatedHistory = [historyEntry, ...currentHistory]

            const updatePayload = {
                title: newTitle,
                content: newContent || null,
                priority,
                target_shift: newShiftsStr,
                target_shifts: effectiveShifts,
                assigned_to: assignedTo || null,
                assigned_to_name: assignedUser ? assignedUser.full_name : null,
                images,
                edit_history: updatedHistory,
                updated_at: now,
            }

            const { data, error } = await (supabase as any)
                .from('shift_tasks')
                .update(updatePayload)
                .eq('id', task.id)
                .select()
                .single()

            if (error) throw error

            onTaskUpdated(data)
            onClose()
        } catch (err: any) {
            console.error('Error updating task:', err)
            setErrorMsg(err.message || 'Không thể lưu thay đổi. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-stone-50/80 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                            <History className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-stone-900">
                                Sửa việc / lời nhắc #{task.code}
                            </h3>
                            <p className="text-xs text-stone-500">
                                Người tạo: <strong>{task.created_by_name || 'Hệ thống'}</strong> • Lịch sử sửa sẽ được tự động ghi lại
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

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    {!isCreator && (
                        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold block">Bạn không có quyền chỉnh sửa việc này</span>
                                Chỉ người tạo việc (<strong>{task.created_by_name || 'Hệ thống'}</strong>) mới có quyền chỉnh sửa nội dung công việc.
                            </div>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Tiêu đề */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                            Tiêu đề công việc / Nhắc nhở <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={!isCreator || submitting}
                            placeholder="Ví dụ: Kiểm đếm khay hàng dở dang lô A12, nạp ắc quy xe nâng..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition disabled:bg-stone-100 disabled:text-stone-400"
                            required
                        />
                    </div>

                    {/* Giao cho Đội / Ca / Đối tượng (Hỗ trợ nhiều đội) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                                <span>Giao cho Đội / Ca / Đối tượng</span>
                                <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                    {targetShifts.length} đối tượng nhận việc
                                </span>
                            </label>
                            {teams.length > 0 && isCreator && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={selectAllTeams}
                                        className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                                    >
                                        Chọn tất cả đội ({teams.length})
                                    </button>
                                    {targetShifts.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={clearTeams}
                                            className="text-[11px] text-stone-400 hover:text-stone-600"
                                        >
                                            Đặt lại
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Selected Pills container */}
                        <div className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2.5">
                            <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                                {targetShifts.map((shift, idx) => {
                                    const isTeam = shift.startsWith('Đội')
                                    return (
                                        <span
                                            key={idx}
                                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-2xs transition ${
                                                isTeam
                                                    ? 'bg-purple-100 text-purple-800 border-purple-200'
                                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                            }`}
                                        >
                                            <span>{isTeam ? `👥 ${shift}` : `🎯 ${shift}`}</span>
                                            {isCreator && targetShifts.length > 1 && (
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

                            {/* Clickable available teams */}
                            {teams.length > 0 && isCreator && (
                                <div className="pt-2 border-t border-stone-200/60">
                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                                        Bấm để chọn nhiều Đội cùng nhận việc:
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {teams.map(t => {
                                            const teamName = `Đội ${t.name}`
                                            const isSelected = targetShifts.includes(teamName)
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => toggleTargetShift(teamName)}
                                                    className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 ${
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
                            )}

                            {/* Tùy chọn Ca */}
                            {isCreator && (
                                <div className="pt-2 border-t border-stone-200/60 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-stone-400 font-medium mr-1">Hoặc Ca:</span>
                                    {['Ca tiếp theo', 'Ca 1 (Sáng)', 'Ca 2 (Chiều)', 'Ca 3 (Đêm)', 'Toàn ca'].map((c) => {
                                        const isSelected = targetShifts.includes(c)
                                        return (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => toggleTargetShift(c)}
                                                className={`text-[11px] px-2.5 py-1 rounded-md border transition font-medium ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                                                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                                                }`}
                                            >
                                                {isSelected ? '✓ ' : ''}{c}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Hàng: Mức độ ưu tiên & Người nhận cụ thể */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1.5">
                                Mức độ ưu tiên
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    disabled={!isCreator}
                                    onClick={() => setPriority('normal')}
                                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                                        priority === 'normal'
                                            ? 'bg-stone-800 text-white border-stone-800 shadow-sm'
                                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                    Bình thường
                                </button>
                                <button
                                    type="button"
                                    disabled={!isCreator}
                                    onClick={() => setPriority('important')}
                                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                                        priority === 'important'
                                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                            : 'bg-amber-50/50 text-amber-700 border-amber-200 hover:bg-amber-100/60'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                    Quan trọng
                                </button>
                                <button
                                    type="button"
                                    disabled={!isCreator}
                                    onClick={() => setPriority('urgent')}
                                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1 transition ${
                                        priority === 'urgent'
                                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                            : 'bg-red-50/50 text-red-700 border-red-200 hover:bg-red-100/60'
                                    }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-400"></span>
                                    Khẩn cấp
                                </button>
                            </div>
                        </div>

                        {/* Người phụ trách cụ thể */}
                        <div>
                            <label className="block text-xs font-bold text-stone-700 mb-1">
                                Người nhận cụ thể (tùy chọn)
                            </label>
                            <select
                                value={assignedTo}
                                disabled={!isCreator}
                                onChange={(e) => setAssignedTo(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                            >
                                <option value="">-- Bất kỳ ai trong ca / đội --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>
                                        {u.full_name} {u.employee_code ? `(${u.employee_code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Nội dung chi tiết */}
                    <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1">
                            Ghi chú dở dang & Dặn dò chi tiết
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            disabled={!isCreator || submitting}
                            rows={3}
                            placeholder="Mô tả cụ thể hiện trạng máy móc, khay hàng để ở đâu, cần làm gì tiếp theo..."
                            className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none disabled:bg-stone-100"
                        />
                    </div>

                    {/* Đính kèm ảnh */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-stone-700">
                                Ảnh hiện trường ({images.length})
                            </label>
                            {isCreator && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-700 bg-stone-50 hover:bg-stone-100 text-xs font-medium inline-flex items-center gap-1 transition"
                                    >
                                        <Camera className="w-3.5 h-3.5 text-stone-600" />
                                        <span>Chụp ảnh</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingImage}
                                        className="px-2.5 py-1 rounded-lg border border-stone-200 text-stone-700 bg-stone-50 hover:bg-stone-100 text-xs font-medium inline-flex items-center gap-1 transition"
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 text-stone-600" />
                                        <span>Chọn ảnh</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e.target.files)}
                        />

                        {uploadingImage && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center justify-center gap-2 mb-2">
                                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                                <span>Đang nén và tải ảnh lên...</span>
                            </div>
                        )}

                        {images.length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-stone-50 border border-stone-200">
                                {images.map((img, idx) => (
                                    <div key={idx} className="relative aspect-video rounded-lg overflow-hidden border border-stone-200 group bg-stone-100">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                                        {isCreator && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(idx)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600 transition"
                                                title="Xóa ảnh này"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-4 border border-dashed border-stone-200 rounded-xl bg-stone-50/50 text-stone-400 text-xs">
                                Chưa có ảnh hiện trường đính kèm
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-semibold transition"
                    >
                        Hủy
                    </button>
                    {isCreator && (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || uploadingImage || !title.trim()}
                            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/25 flex items-center gap-1.5 transition disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Lưu thay đổi & Ghi lịch sử</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
