'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, CheckCircle2, Camera, Image as ImageIcon, Loader2, AlertTriangle, Check, Users, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/contexts/UserContext'
import { ShiftTask, TeamCompletion } from './types'
import { uploadTaskImage, getAssignedTeams, getTeamCompletions, isTeamCompleted, canUserCompleteTeamTask } from './taskUtils'

interface CompleteTaskModalProps {
    isOpen: boolean
    task: ShiftTask | null
    myTeamNames?: string[]
    onClose: () => void
    onTaskCompleted: (updatedTask: ShiftTask) => void
}

export default function CompleteTaskModal({ isOpen, task, myTeamNames = [], onClose, onTaskCompleted }: CompleteTaskModalProps) {
    const { profile } = useUser()
    const [selectedTeam, setSelectedTeam] = useState<string>('')
    const [notes, setNotes] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [uploadingImage, setUploadingImage] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const fileInputRef = useRef<HTMLInputElement>(null)
    const cameraInputRef = useRef<HTMLInputElement>(null)

    const assignedTeams = task ? getAssignedTeams(task) : []
    const completionInfo = task ? canUserCompleteTeamTask(task, profile, myTeamNames) : { canComplete: false, eligibleTeams: [], alreadyCompletedTeams: [], isCreatorOrAdmin: false }
    const currentCompletions = task ? getTeamCompletions(task) : []

    useEffect(() => {
        if (isOpen && task) {
            setNotes('')
            setImages([])
            setErrorMsg('')
            // Auto-select first eligible team
            if (completionInfo.eligibleTeams.length > 0) {
                setSelectedTeam(completionInfo.eligibleTeams[0])
            } else if (assignedTeams.length === 1) {
                setSelectedTeam(assignedTeams[0])
            } else {
                setSelectedTeam('')
            }
        }
    }, [isOpen, task?.id])

    if (!isOpen || !task) return null

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
        setSubmitting(true)
        setErrorMsg('')

        try {
            const now = new Date().toISOString()
            const targetTeam = selectedTeam || (assignedTeams.length === 1 ? assignedTeams[0] : (completionInfo.eligibleTeams[0] || 'Chung'))

            // New completion entry
            const newCompletion: TeamCompletion = {
                team_name: targetTeam,
                completed_by: profile?.id || null,
                completed_by_name: profile?.full_name || 'Nhân viên',
                completed_at: now,
                notes: notes.trim() || null,
                images: images,
            }

            // Merge with existing completions (replace if this team already had one)
            const targetNorm = targetTeam.toLowerCase().trim().replace(/^đội\s+/, '')
            const updatedCompletions = [
                ...currentCompletions.filter(c => {
                    const cNorm = (c.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
                    return cNorm !== targetNorm
                }),
                newCompletion,
            ]

            // Check if all assigned teams have completed
            let isAllDone = false
            if (assignedTeams.length <= 1) {
                isAllDone = true
            } else {
                isAllDone = assignedTeams.every(teamName => {
                    const tNorm = teamName.toLowerCase().trim().replace(/^đội\s+/, '')
                    return updatedCompletions.some(c => {
                        const cNorm = (c.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
                        return cNorm === tNorm
                    })
                })
            }

            // Construct acknowledgements payload (fallback storage so team completions persist reliably)
            const existingAcks = Array.isArray(task.acknowledgements) ? [...task.acknowledgements] : []
            existingAcks.push({
                user_id: profile?.id || null,
                user_name: profile?.full_name || 'Nhân viên',
                is_completed: true,
                completed_team: targetTeam,
                completed_at: now,
                completion_notes: notes.trim() || null,
                completion_images: images,
                acknowledged_at: now,
            })

            const payload: any = {
                status: isAllDone ? 'completed' : 'in_progress',
                acknowledgements: existingAcks,
            }

            // Only set root completed_at/completed_by if all teams finished or it's single team
            if (isAllDone) {
                payload.completed_by = profile?.id || null
                payload.completed_by_name = profile?.full_name || 'Nhân viên'
                payload.completed_at = now
                payload.completion_notes = notes.trim() || task.completion_notes || null
                payload.completion_images = images.length > 0 ? images : (task.completion_images || [])
            } else {
                // If only 1 team completed, append to completion_notes for audit
                const teamNote = `[${targetTeam}] ${profile?.full_name || 'Nhân viên'}: ${notes.trim() || 'Đã hoàn thành'}`
                payload.completion_notes = task.completion_notes ? `${task.completion_notes}\n${teamNote}` : teamNote
            }

            const { data, error } = await (supabase as any)
                .from('shift_tasks')
                .update(payload)
                .eq('id', task.id)
                .select()
                .single()

            if (error) throw error

            const fullUpdatedTask: ShiftTask = {
                ...data,
                team_completions: updatedCompletions,
            }

            onTaskCompleted(fullUpdatedTask)
            onClose()
        } catch (err: any) {
            console.error('Error completing task:', err)
            setErrorMsg(err.message || 'Không thể hoàn thành việc. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[94vh] flex flex-col border border-stone-200 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-stone-800">Xác Nhận Hoàn Thành Việc</h2>
                            <p className="text-xs text-stone-500">Mã: #{task.code} - {task.title}</p>
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

                    {/* Multi-team Status Breakdown */}
                    {assignedTeams.length > 1 && (
                        <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-stone-700">
                                <span className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-stone-500" />
                                    Tiến độ các đội thực hiện ({currentCompletions.length}/{assignedTeams.length} đã xong):
                                </span>
                            </div>
                            <div className="grid grid-cols-1 gap-1.5">
                                {assignedTeams.map(t => {
                                    const done = isTeamCompleted(task, t)
                                    const comp = currentCompletions.find(c => {
                                        const cNorm = (c.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
                                        const tNorm = t.toLowerCase().trim().replace(/^đội\s+/, '')
                                        return cNorm === tNorm
                                    })
                                    return (
                                        <div
                                            key={t}
                                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs ${
                                                done
                                                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                                                    : 'bg-white border border-stone-200 text-stone-600'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {done ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                ) : (
                                                    <Clock className="w-4 h-4 text-amber-500" />
                                                )}
                                                <span className="font-semibold">{t}</span>
                                            </div>
                                            <span className="text-[11px]">
                                                {done ? `Xong (${comp?.completed_by_name || 'Đã báo'})` : 'Chưa hoàn thành'}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Team Selection if multiple eligible teams */}
                    {assignedTeams.length > 0 && (
                        <div>
                            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                                Báo hoàn thành cho đội nào?
                            </label>
                            {completionInfo.eligibleTeams.length > 1 ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {completionInfo.eligibleTeams.map(t => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setSelectedTeam(t)}
                                            className={`px-3 py-2 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between ${
                                                selectedTeam === t
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                                                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                                            }`}
                                        >
                                            <span>{t}</span>
                                            {selectedTeam === t && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                        </button>
                                    ))}
                                </div>
                            ) : completionInfo.eligibleTeams.length === 1 ? (
                                <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                    <span>Bạn đang xác nhận cho: <strong className="font-bold">{completionInfo.eligibleTeams[0]}</strong></span>
                                </div>
                            ) : (
                                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                    <span>Tất cả các đội bạn tham gia đều đã hoàn thành hoặc bạn không thuộc các đội được giao.</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                            Ghi chú kết quả thực hiện <span className="text-stone-400 font-normal">(Tùy chọn)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="VD: Đã hoàn tất đóng gói 200 kiện, xe nâng chuyển hàng vào kho lạnh ổn định..."
                            className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 text-stone-800 text-sm placeholder:text-stone-400 transition"
                        />
                    </div>

                    {/* Ảnh nghiệm thu */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-semibold text-stone-700 flex items-center gap-1.5">
                                <ImageIcon className="w-4 h-4 text-emerald-600" />
                                Ảnh chụp kết quả / Nghiệm thu <span className="text-stone-400 font-normal">(Tùy chọn)</span>
                            </label>
                            <span className="text-xs text-stone-400">
                                {images.length > 0 ? `${images.length} ảnh đã chọn` : ''}
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

                        {/* Image preview & action */}
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
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

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/40 flex flex-col items-center justify-center text-stone-500 hover:text-emerald-700 transition p-2 text-center group"
                            >
                                {uploadingImage ? (
                                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                                ) : (
                                    <>
                                        <ImageIcon className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 mb-1 transition" />
                                        <span className="text-[11px] font-medium leading-tight">Thêm ảnh</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="aspect-square rounded-xl border-2 border-dashed border-stone-200 hover:border-emerald-400 hover:bg-emerald-50/40 flex flex-col items-center justify-center text-stone-500 hover:text-emerald-700 transition p-2 text-center group"
                            >
                                <Camera className="w-5 h-5 text-stone-400 group-hover:text-emerald-600 mb-1 transition" />
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
                            Đóng
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || uploadingImage || (assignedTeams.length > 0 && !selectedTeam && completionInfo.eligibleTeams.length === 0)}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang lưu...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>
                                        {assignedTeams.length > 1 && selectedTeam
                                            ? `Xong phần việc: ${selectedTeam}`
                                            : 'Xác Nhận Đã Xong'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
