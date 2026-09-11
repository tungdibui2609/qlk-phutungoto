'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CheckCircle2, Clock, User, AlertTriangle, Send, Loader2, MessageSquare, Image as ImageIcon, Trash2, Check, ArrowRight, ShieldCheck, Pencil, History, Camera, Users } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/contexts/UserContext'
import { ShiftTask, ShiftTaskMessage } from './types'
import { formatDateTime, formatDateRelative, uploadTaskImage, getAssignedTeams, getTeamCompletions, isTeamCompleted, getTaskTeamProgress, canUserCompleteTeamTask } from './taskUtils'
import ImageLightbox from './ImageLightbox'
import EditTaskModal from './EditTaskModal'

interface TaskDetailModalProps {
    isOpen: boolean
    task: ShiftTask | null
    myTeamNames?: string[]
    onClose: () => void
    onTaskUpdated: (updatedTask: ShiftTask) => void
    onTaskDeleted: (taskId: string) => void
    onOpenCompleteModal: (task: ShiftTask) => void
}

export default function TaskDetailModal({
    isOpen,
    task,
    myTeamNames = [],
    onClose,
    onTaskUpdated,
    onTaskDeleted,
    onOpenCompleteModal,
}: TaskDetailModalProps) {
    const { profile } = useUser()

    const [messages, setMessages] = useState<ShiftTaskMessage[]>([])
    const [loadingMessages, setLoadingMessages] = useState(false)
    const [newMessage, setNewMessage] = useState('')
    const [sendingMessage, setSendingMessage] = useState(false)
    const [acknowledging, setAcknowledging] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)

    // Lightbox state
    const [lightboxImages, setLightboxImages] = useState<string[]>([])
    const [lightboxIndex, setLightboxIndex] = useState(0)
    const [showLightbox, setShowLightbox] = useState(false)

    // Chat image upload state
    const [messageImages, setMessageImages] = useState<string[]>([])
    const [uploadingMessageImage, setUploadingMessageImage] = useState(false)
    const chatFileInputRef = useRef<HTMLInputElement>(null)

    const handleSelectChatImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploadingMessageImage(true)
        try {
            const uploadedUrls: string[] = []
            for (let i = 0; i < files.length; i++) {
                const url = await uploadTaskImage(files[i])
                uploadedUrls.push(url)
            }
            setMessageImages(prev => [...prev, ...uploadedUrls])
        } catch (err) {
            console.error('Lỗi tải ảnh trao đổi:', err)
            alert('Không thể tải ảnh lên. Vui lòng thử lại.')
        } finally {
            setUploadingMessageImage(false)
            if (chatFileInputRef.current) chatFileInputRef.current.value = ''
        }
    }

    const handleRemoveChatImage = (idx: number) => {
        setMessageImages(prev => prev.filter((_, i) => i !== idx))
    }

    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Load comments/messages for this task
    useEffect(() => {
        if (!isOpen || !task) return

        const loadMessages = async () => {
            setLoadingMessages(true)
            try {
                const { data, error } = await (supabase as any)
                    .from('shift_task_messages')
                    .select('*')
                    .eq('task_id', task.id)
                    .order('created_at', { ascending: true })

                if (error) throw error
                setMessages(data || [])
            } catch (err) {
                console.error('Error loading task messages:', err)
            } finally {
                setLoadingMessages(false)
            }
        }

        loadMessages()

        // Realtime subscription for messages
        const channel = supabase
            .channel(`task_messages_${task.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'shift_task_messages',
                    filter: `task_id=eq.${task.id}`,
                },
                (payload) => {
                    const newMsg = payload.new as ShiftTaskMessage
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMsg.id)) return prev
                        return [...prev, newMsg]
                    })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [isOpen, task])

    // Scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    if (!isOpen || !task) return null

    const handleOpenLightbox = (imgs: string[], index: number) => {
        setLightboxImages(imgs)
        setLightboxIndex(index)
        setShowLightbox(true)
    }

    // Xác nhận tiếp nhận bàn giao (hỗ trợ nhiều người)
    const handleAcknowledge = async () => {
        setAcknowledging(true)
        try {
            const now = new Date().toISOString()
            const currentAcks: any[] = Array.isArray(task.acknowledgements) ? task.acknowledgements : []
            const alreadyAcked = currentAcks.some(a => a.user_id === profile?.id || (a.user_name && a.user_name === profile?.full_name))

            const updatedAcks = alreadyAcked
                ? currentAcks
                : [
                    ...currentAcks,
                    {
                        user_id: profile?.id || null,
                        user_name: profile?.full_name || 'Nhân viên tiếp nhận',
                        acknowledged_at: now,
                    }
                ]

            const payload = {
                status: task.status === 'pending' ? 'in_progress' : task.status,
                acknowledgements: updatedAcks,
                acknowledged_by: task.acknowledged_by || profile?.id || null,
                acknowledged_by_name: task.acknowledged_by_name || profile?.full_name || 'Nhân viên tiếp nhận',
                acknowledged_at: task.acknowledged_at || now,
            }

            const { data, error } = await (supabase as any)
                .from('shift_tasks')
                .update(payload)
                .eq('id', task.id)
                .select()
                .single()

            if (error) throw error
            onTaskUpdated(data)
        } catch (err) {
            console.error('Error acknowledging task:', err)
            alert('Không thể xác nhận tiếp nhận việc. Vui lòng thử lại.')
        } finally {
            setAcknowledging(false)
        }
    }

    // Gửi tin nhắn trao đổi (kèm ảnh)
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault()
        if ((!newMessage.trim() && messageImages.length === 0) || sendingMessage || uploadingMessageImage) return

        setSendingMessage(true)
        try {
            const payload = {
                task_id: task.id,
                company_id: task.company_id,
                user_id: profile?.id || null,
                user_name: profile?.full_name || 'Nhân viên',
                message: newMessage.trim(),
                images: messageImages,
            }

            const { data, error } = await (supabase as any)
                .from('shift_task_messages')
                .insert([payload])
                .select()
                .single()

            if (error) throw error
            setMessages(prev => [...prev, data])
            setNewMessage('')
            setMessageImages([])
        } catch (err) {
            console.error('Error sending message:', err)
        } finally {
            setSendingMessage(false)
        }
    }

    const isCreator = Boolean(
        task &&
        (profile?.id === task.created_by ||
            (profile?.full_name && task.created_by_name === profile.full_name) ||
            profile?.role === 'admin')
    )

    // Xóa việc (chỉ người tạo mới được xóa)
    const handleDelete = async () => {
        if (!isCreator) {
            alert('Chỉ người tạo việc mới có quyền xóa lời nhắc này.')
            return
        }
        if (!confirm(`Bạn có chắc chắn muốn xóa lời nhắc việc #${task.code}?`)) return
        setDeleting(true)
        try {
            const { error } = await (supabase as any)
                .from('shift_tasks')
                .delete()
                .eq('id', task.id)

            if (error) throw error
            onTaskDeleted(task.id)
            onClose()
        } catch (err) {
            console.error('Error deleting task:', err)
            alert('Không thể xóa việc.')
        } finally {
            setDeleting(false)
        }
    }

    const isPending = task.status === 'pending'
    const isInProgress = task.status === 'in_progress'
    const isCompleted = task.status === 'completed'

    const acks: any[] = Array.isArray(task.acknowledgements) && task.acknowledgements.length > 0
        ? task.acknowledgements
        : (task.acknowledged_by_name ? [{ user_id: task.acknowledged_by, user_name: task.acknowledged_by_name, acknowledged_at: task.acknowledged_at || task.created_at }] : [])

    const hasMyAck = acks.some(a => a.user_id === profile?.id || (a.user_name && a.user_name === profile?.full_name))

    return (
        <>
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
                <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-3xl border border-stone-200 overflow-hidden flex flex-col max-h-[94vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/80">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-stone-200 text-stone-700">
                                #{task.code}
                            </span>
                            {task.priority === 'urgent' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                    Khẩn cấp
                                </span>
                            )}
                            {task.priority === 'important' && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Quan trọng
                                </span>
                            )}
                            {(() => {
                                const shiftsList: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
                                    ? task.target_shifts
                                    : (task.target_shift ? task.target_shift.split(',').map(s => s.trim()).filter(Boolean) : [])
                                return shiftsList.map((shift, idx) => (
                                    <span
                                        key={idx}
                                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border shadow-2xs ${
                                            shift.startsWith('Đội')
                                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}
                                    >
                                        {shift.startsWith('Đội') ? `👥 ${shift}` : `🎯 ${shift}`}
                                    </span>
                                ))
                            })()}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {isCreator && (
                                <>
                                    <button
                                        onClick={() => setShowEditModal(true)}
                                        className="px-2.5 py-1.5 rounded-xl border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 hover:text-amber-700 transition flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                        title="Chỉnh sửa nội dung việc (Chỉ người tạo)"
                                    >
                                        <Pencil className="w-3.5 h-3.5 text-stone-500" />
                                        <span>Sửa</span>
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={deleting}
                                        className="p-2 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                                        title="Xóa lời nhắc này"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Title & Content */}
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold text-stone-900 leading-snug">{task.title}</h3>
                            {task.content && (
                                <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 text-sm text-stone-800 whitespace-pre-line leading-relaxed">
                                    {task.content}
                                </div>
                            )}
                        </div>

                        {/* Metadata grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-stone-50 border border-stone-100 text-xs">
                            <div>
                                <span className="text-stone-400 block mb-0.5">Người giao</span>
                                <span className="font-semibold text-stone-800 flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-stone-400" />
                                    {task.created_by_name || 'Hệ thống'}
                                </span>
                            </div>
                            <div>
                                <span className="text-stone-400 block mb-0.5">Thời gian giao</span>
                                <span className="font-semibold text-stone-800">
                                    {formatDateTime(task.created_at)}
                                </span>
                            </div>
                            <div>
                                <span className="text-stone-400 block mb-0.5">Đã tiếp nhận ({acks.length})</span>
                                <span className="font-semibold text-stone-800 truncate block" title={acks.map(a => a.user_name).join(', ')}>
                                    {acks.length > 0 ? acks.map(a => a.user_name).join(', ') : (task.assigned_to_name || 'Bất kỳ ai trong ca')}
                                </span>
                            </div>
                            <div>
                                <span className="text-stone-400 block mb-0.5">Thời gian nhận</span>
                                <span className="font-semibold text-stone-800">
                                    {acks.length > 0 ? formatDateTime(acks[0].acknowledged_at) : 'Chưa nhận'}
                                </span>
                            </div>
                        </div>

                        {/* Attached Images lúc tạo việc */}
                        {task.images && task.images.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <ImageIcon className="w-4 h-4 text-amber-600" />
                                    Ảnh hiện trường lúc bàn giao ({task.images.length})
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {task.images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleOpenLightbox(task.images, idx)}
                                            className="relative aspect-video rounded-xl overflow-hidden border border-stone-200 bg-stone-100 cursor-pointer group shadow-sm hover:shadow-md transition"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img}
                                                alt={`Hiện trường ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                                Phóng to
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Attached Images lúc nghiệm thu hoàn thành */}
                        {task.completion_images && task.completion_images.length > 0 && (
                            <div>
                                <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Ảnh kết quả sau khi hoàn thành ({task.completion_images.length})
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                    {task.completion_images.map((img, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => handleOpenLightbox(task.completion_images, idx)}
                                            className="relative aspect-video rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50 cursor-pointer group shadow-sm hover:shadow-md transition"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={img}
                                                alt={`Kết quả ${idx + 1}`}
                                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                                            />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-semibold">
                                                Phóng to
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Lịch sử chỉnh sửa nếu có */}
                        {task.edit_history && task.edit_history.length > 0 && (
                            <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2.5">
                                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <History className="w-4 h-4 text-amber-600" />
                                    Lịch sử chỉnh sửa ({task.edit_history.length} lần)
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {task.edit_history.map((entry, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-white border border-stone-200 text-xs space-y-1.5 shadow-2xs">
                                            <div className="flex items-center justify-between text-stone-500 font-medium border-b border-stone-100 pb-1.5">
                                                <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                                                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[10px]">
                                                        {(entry.edited_by_name || 'N').charAt(0).toUpperCase()}
                                                    </div>
                                                    {entry.edited_by_name || 'Người tạo việc'}
                                                </span>
                                                <span className="text-[10px] text-stone-400">
                                                    {formatDateTime(entry.edited_at)}
                                                </span>
                                            </div>
                                            <ul className="list-disc list-inside text-stone-600 space-y-0.5 pt-0.5">
                                                {entry.changes.map((change, cIdx) => (
                                                    <li key={cIdx} className="text-[11px] leading-relaxed text-stone-700 font-normal">
                                                        {change}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Trao đổi tin nhắn giữa 2 ca */}
                        <div className="pt-4 border-t border-stone-100">
                            <h4 className="text-sm font-bold text-stone-800 mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                Trao đổi & Hỏi đáp về việc này ({messages.length})
                            </h4>

                            {/* Message Feed */}
                            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                                {loadingMessages ? (
                                    <div className="py-6 flex justify-center">
                                        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                                    </div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-6 text-stone-400 text-xs bg-stone-50 rounded-xl border border-dashed border-stone-200">
                                        Chưa có trao đổi nào. Ca 2 nếu có thắc mắc có thể gửi câu hỏi bên dưới!
                                    </div>
                                ) : (
                                    messages.map((m) => {
                                        const isMe = m.user_id === profile?.id
                                        return (
                                            <div
                                                key={m.id}
                                                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[11px] font-bold text-stone-600">
                                                        {m.user_name || 'Nhân viên'}
                                                    </span>
                                                    <span className="text-[10px] text-stone-400">
                                                        {formatDateRelative(m.created_at)}
                                                    </span>
                                                </div>
                                                <div
                                                    className={`px-3.5 py-2.5 rounded-2xl text-xs max-w-[85%] space-y-2 leading-relaxed ${
                                                        isMe
                                                            ? 'bg-blue-600 text-white rounded-br-none'
                                                            : 'bg-stone-100 text-stone-800 rounded-bl-none'
                                                    }`}
                                                >
                                                    {m.message && <div>{m.message}</div>}
                                                    {m.images && m.images.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {m.images.map((img, imgIdx) => (
                                                                <div
                                                                    key={imgIdx}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleOpenLightbox(m.images, imgIdx)
                                                                    }}
                                                                    className="w-20 h-20 rounded-xl overflow-hidden border border-black/10 relative cursor-pointer group bg-black/5"
                                                                >
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={img}
                                                                        alt={`Ảnh trao đổi ${imgIdx + 1}`}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition"
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Ảnh đính kèm đang chuẩn bị gửi */}
                            {messageImages.length > 0 && (
                                <div className="flex items-center gap-2 mb-2 p-2 bg-stone-50 rounded-xl border border-stone-200 overflow-x-auto">
                                    {messageImages.map((img, idx) => (
                                        <div key={idx} className="relative w-14 h-14 rounded-lg overflow-hidden border border-stone-200 flex-shrink-0 group">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={img} alt="Đính kèm" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveChatImage(idx)}
                                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center text-[10px] hover:bg-black"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    {uploadingMessageImage && (
                                        <div className="w-14 h-14 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
                                            <Loader2 className="w-4 h-4 animate-spin text-stone-400" />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Input box */}
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                                <input
                                    type="file"
                                    ref={chatFileInputRef}
                                    onChange={handleSelectChatImages}
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                />

                                <button
                                    type="button"
                                    onClick={() => chatFileInputRef.current?.click()}
                                    disabled={uploadingMessageImage}
                                    className="p-2.5 rounded-xl border border-stone-200 text-stone-600 hover:text-blue-600 hover:bg-blue-50 transition flex-shrink-0"
                                    title="Chụp ảnh hoặc chọn ảnh đính kèm"
                                >
                                    {uploadingMessageImage ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    ) : (
                                        <Camera className="w-4 h-4" />
                                    )}
                                </button>

                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Hỏi lại ca trước hoặc gửi ảnh hiện trường..."
                                    className="flex-1 px-4 py-2 rounded-xl border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition"
                                />

                                <button
                                    type="submit"
                                    disabled={(!newMessage.trim() && messageImages.length === 0) || sendingMessage || uploadingMessageImage}
                                    className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
                                    title="Gửi tin nhắn"
                                >
                                    {sendingMessage ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Status banner & Danh sách thành viên tiếp nhận (Đặt dưới cùng) */}
                        {isPending && (
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-900">Đang chờ tiếp nhận việc</h4>
                                        <p className="text-xs text-amber-700 mt-0.5">
                                            {task.created_by_name} đã giao việc. Các thành viên nhận việc hãy kiểm tra nội dung & ảnh rồi bấm xác nhận tiếp nhận.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAcknowledge}
                                    disabled={acknowledging}
                                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/25 flex items-center justify-center gap-1.5 transition flex-shrink-0"
                                >
                                    {acknowledging ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            <span>Xác nhận tiếp nhận việc</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Multi-team Progress Section */}
                        {(() => {
                            const assignedTeams = getAssignedTeams(task)
                            if (assignedTeams.length <= 1) return null
                            const teamProgress = getTaskTeamProgress(task)
                            const teamCompletions = getTeamCompletions(task)

                            return (
                                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
                                                <Users className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-purple-900">Tiến độ thực hiện của các đội</h4>
                                                <p className="text-xs text-purple-700">
                                                    {teamProgress.isAllCompleted
                                                        ? 'Tất cả các đội được giao đã hoàn thành xuất sắc nhiệm vụ!'
                                                        : `Đã có ${teamProgress.completedCount}/${teamProgress.total} đội báo hoàn tất.`}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${
                                            teamProgress.isAllCompleted
                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                : 'bg-amber-100 text-amber-800 border-amber-300'
                                        }`}>
                                            {teamProgress.ratioText} ({teamProgress.percent}%)
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-purple-200/60 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 ${
                                                teamProgress.isAllCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-500 to-emerald-500'
                                            }`}
                                            style={{ width: `${teamProgress.percent}%` }}
                                        />
                                    </div>

                                    {/* Cards for each team */}
                                    <div className="grid grid-cols-1 gap-2 pt-1">
                                        {assignedTeams.map(teamName => {
                                            const isDone = isTeamCompleted(task, teamName)
                                            const completion = teamCompletions.find(c => {
                                                const cNorm = (c.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
                                                const tNorm = teamName.toLowerCase().trim().replace(/^đội\s+/, '')
                                                return cNorm === tNorm
                                            })

                                            return (
                                                <div
                                                    key={teamName}
                                                    className={`p-3 rounded-xl border text-xs transition ${
                                                        isDone
                                                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                                                            : 'bg-white border-stone-200 text-stone-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            {isDone ? (
                                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                            ) : (
                                                                <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                                            )}
                                                            <span className="font-bold text-sm text-stone-900">{teamName}</span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {isDone ? 'Đã hoàn thành' : 'Đang thực hiện'}
                                                        </span>
                                                    </div>

                                                    {isDone && completion ? (
                                                        <div className="mt-1 space-y-1 text-stone-600">
                                                            <div className="text-[11px]">
                                                                Báo bởi: <strong className="text-stone-800">{completion.completed_by_name || 'Nhân viên'}</strong> ({formatDateTime(completion.completed_at)})
                                                            </div>
                                                            {completion.notes && (
                                                                <div className="text-[11px] p-2 bg-white/80 rounded-lg border border-emerald-100 text-stone-800">
                                                                    📝 {completion.notes}
                                                                </div>
                                                            )}
                                                            {completion.images && completion.images.length > 0 && (
                                                                <div className="flex items-center gap-1.5 pt-1">
                                                                    {completion.images.map((img, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            onClick={() => {
                                                                                setLightboxImages(completion.images || [])
                                                                                setLightboxIndex(idx)
                                                                                setShowLightbox(true)
                                                                            }}
                                                                            className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 bg-stone-100 flex-shrink-0 cursor-pointer hover:opacity-80 transition"
                                                                        >
                                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                            <img src={img} alt={`Nghiệm thu ${idx + 1}`} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-stone-400 mt-1 italic">
                                                            Đội chưa bấm xác nhận hoàn thành phần việc này.
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })()}

                        {isInProgress && (
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-blue-100 text-blue-700 mt-0.5">
                                            <ShieldCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                                <span>Đang thực hiện</span>
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">
                                                    {acks.length} người đã nhận việc
                                                </span>
                                            </h4>
                                            <p className="text-xs text-blue-700 mt-0.5">
                                                {hasMyAck ? '✓ Bạn đã xác nhận tiếp nhận việc này.' : 'Bạn chưa xác nhận tiếp nhận. Hãy bấm nút bên phải để xác nhận cùng làm.'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                        {!hasMyAck && (
                                            <button
                                                type="button"
                                                onClick={handleAcknowledge}
                                                disabled={acknowledging}
                                                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition flex-shrink-0"
                                            >
                                                {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                                <span>Tôi cũng tiếp nhận</span>
                                            </button>
                                        )}
                                        {(() => {
                                            const completionInfo = canUserCompleteTeamTask(task, profile, myTeamNames)
                                            if (completionInfo.canComplete) {
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => onOpenCompleteModal(task)}
                                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition flex-shrink-0"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
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
                                                    <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100 border border-emerald-300 px-3 py-2 rounded-xl flex-shrink-0">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                        <span>Đội bạn đã xong</span>
                                                    </div>
                                                )
                                            }
                                            return null
                                        })()}
                                    </div>
                                </div>

                                {/* Danh sách chi tiết những người đã xác nhận */}
                                {acks.length > 0 && (
                                    <div className="pt-3 border-t border-blue-200/60">
                                        <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block mb-2">
                                            Danh sách thành viên đã xác nhận ({acks.length}):
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {acks.map((ack, i) => (
                                                <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-blue-100 shadow-2xs text-xs">
                                                    <span className="font-semibold text-stone-800 flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px]">
                                                            {(ack.user_name || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        {ack.user_name}
                                                    </span>
                                                    <span className="text-[11px] text-stone-400 font-medium">
                                                        {formatDateTime(ack.acknowledged_at)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isCompleted && (
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-emerald-900">Công việc đã hoàn thành</h4>
                                    <p className="text-xs text-emerald-700 mt-0.5">
                                        Hoàn tất bởi <strong>{task.completed_by_name}</strong> lúc {formatDateTime(task.completed_at)}
                                    </p>
                                    {task.completion_notes && (
                                        <p className="text-xs text-emerald-800 mt-2 p-2.5 rounded-lg bg-emerald-100/60 font-medium">
                                            📝 Ghi chú hoàn thành: {task.completion_notes}
                                        </p>
                                    )}
                                    {acks.length > 0 && (
                                        <div className="mt-2.5 pt-2.5 border-t border-emerald-200/60">
                                            <span className="text-[11px] font-bold text-emerald-900 block mb-1">
                                                👥 Các thành viên đã tiếp nhận ({acks.length}):
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {acks.map((ack, i) => (
                                                    <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-white border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-medium shadow-2xs">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        {ack.user_name}
                                                        <span className="text-[10px] text-stone-400">({formatDateTime(ack.acknowledged_at)})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="px-6 py-3 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                        <span className="text-xs text-stone-400 font-medium">
                            Cập nhật lần cuối: {formatDateTime(task.updated_at)}
                        </span>
                        <div className="flex items-center gap-2">
                            {isPending && (
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={acknowledging}
                                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/25 flex items-center gap-1.5 transition"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Xác nhận tiếp nhận</span>
                                </button>
                            )}
                            {isInProgress && !hasMyAck && (
                                <button
                                    onClick={handleAcknowledge}
                                    disabled={acknowledging}
                                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Tôi cũng tiếp nhận</span>
                                </button>
                            )}
                            {isInProgress && (() => {
                                const completionInfo = canUserCompleteTeamTask(task, profile, myTeamNames)
                                if (completionInfo.canComplete) {
                                    return (
                                        <button
                                            onClick={() => onOpenCompleteModal(task)}
                                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            <span>
                                                {completionInfo.eligibleTeams.length === 1
                                                    ? `Báo hoàn thành (${completionInfo.eligibleTeams[0].replace(/^Đội\s+/, '')})`
                                                    : 'Đánh dấu hoàn thành'}
                                            </span>
                                        </button>
                                    )
                                }
                                return null
                            })()}
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 text-xs font-semibold transition"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox Modal */}
            {showLightbox && (
                <ImageLightbox
                    images={lightboxImages}
                    currentIndex={lightboxIndex}
                    onClose={() => setShowLightbox(false)}
                    onNavigate={(i) => setLightboxIndex(i)}
                />
            )}

            {/* Edit Task Modal */}
            <EditTaskModal
                isOpen={showEditModal}
                task={task}
                onClose={() => setShowEditModal(false)}
                onTaskUpdated={(updated) => {
                    onTaskUpdated(updated)
                }}
            />
        </>
    )
}
