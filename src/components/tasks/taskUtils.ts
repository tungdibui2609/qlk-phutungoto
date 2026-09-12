/**
 * Utility functions for Shift Tasks
 */

import { TeamCompletion, ShiftTask, TaskType } from './types'

/**
 * Compresses an image file to a lightweight Blob (typically 100KB - 250KB)
 * Uses hardware-accelerated createImageBitmap when available for ultra-fast processing
 */
export const compressImageToBlob = async (
    file: File,
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.70
): Promise<Blob> => {
    // 1. Try modern, fast createImageBitmap API
    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
        try {
            const bitmap = await createImageBitmap(file)
            let width = bitmap.width
            let height = bitmap.height

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width)
                    width = maxWidth
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height)
                    height = maxHeight
                }
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.drawImage(bitmap, 0, 0, width, height)
                bitmap.close()
                return await new Promise<Blob>((resolve) => {
                    canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality)
                })
            }
            bitmap.close()
        } catch {
            // Fallback to FileReader below
        }
    }

    // 2. Fallback FileReader
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width)
                        width = maxWidth
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height)
                        height = maxHeight
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    resolve(file)
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)
                canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality)
            }
            img.onerror = () => resolve(file)
        }
        reader.onerror = () => resolve(file)
    })
}

export const compressImageFile = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.70): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width)
                        width = maxWidth
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height)
                        height = maxHeight
                    }
                }

                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    resolve(event.target?.result as string)
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)
                const dataUrl = canvas.toDataURL('image/jpeg', quality)
                resolve(dataUrl)
            }
            img.onerror = () => reject(new Error('Không thể đọc file hình ảnh'))
        }
        reader.onerror = () => reject(new Error('Lỗi khi đọc file'))
    })
}

export const uploadTaskImage = async (file: File): Promise<string> => {
    try {
        // 1. Nén ảnh cực nhanh phía client từ 10MB xuống ~60KB-100KB (giảm 98% dung lượng truyền mạng)
        const compressedBlob = await compressImageToBlob(file, 1200, 1200, 0.70)
        const cleanBaseName = (file.name || 'image').replace(/\.[^/.]+$/, '')
        const fileName = `${cleanBaseName}.jpg`

        // 2. Gửi file nén siêu nhẹ lên máy chủ (upload trong tích tắc < 0.5s)
        const formData = new FormData()
        formData.append('file', compressedBlob, fileName)
        formData.append('folder', 'shift-tasks')

        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        })

        if (response.ok) {
            const data = await response.json()
            if (data.secureUrl) return data.secureUrl
            if (data.viewUrl) return data.viewUrl
        }
    } catch (err) {
        console.warn('API upload failed, fallback to local compressed dataUrl:', err)
    }

    // Fallback nếu rớt mạng hoặc lỗi API
    return compressImageFile(file, 1200, 1200, 0.70)
}

export const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    return `${time} ${date}`
}

export const formatDateRelative = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '-'
    
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMins / 60)

    if (diffMins < 1) return 'Vừa xong'
    if (diffMins < 60) return `${diffMins} phút trước`
    if (diffHours < 24 && d.getDate() === now.getDate()) {
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
        return `${time} Hôm nay`
    }
    
    return formatDateTime(dateStr)
}

export const generateTaskCode = (type: TaskType = 'task'): string => {
    const d = new Date()
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const rand = Math.floor(100 + Math.random() * 900)
    const prefix = type === 'reminder' ? 'LN' : 'CV'
    return `${prefix}-${yy}${mm}${dd}-${rand}`
}

/**
 * Identify whether a task is a reminder or a todo task
 */
export const getTaskType = (task?: { task_type?: string | null; code?: string; title?: string } | null): TaskType => {
    if (!task) return 'task'
    if (task.task_type === 'reminder') return 'reminder'
    if (task.task_type === 'task') return 'task'

    // Fallback based on code prefix: LN- is reminder, CV- is task
    if (typeof task.code === 'string') {
        const upperCode = task.code.toUpperCase()
        if (upperCode.startsWith('LN-') || upperCode.startsWith('NN-')) return 'reminder'
        if (upperCode.startsWith('CV-')) return 'task'
    }

    return 'task'
}

/**
 * Kiểm tra xem công việc / lời nhắc có được giao cho Toàn bộ / Tất cả các đội hay không
 */
export const isTaskAssignedToAll = (task?: { target_shifts?: string[]; target_shift?: string | null | any } | null): boolean => {
    if (!task) return false
    const isAll = (s: any) => {
        const lower = String(s || '').trim().toLowerCase()
        return lower === 'toàn bộ' || lower === 'toàn đội' || lower === 'tất cả' || lower === 'tất cả các đội' || lower === 'toàn ca'
    }

    if (Array.isArray(task?.target_shifts) && task.target_shifts.length > 0) {
        if (task.target_shifts.some(isAll)) return true
    }

    if (Array.isArray(task?.target_shift)) {
        if (task.target_shift.some(isAll)) return true
    }

    if (typeof task?.target_shift === 'string' && task.target_shift.trim()) {
        const parts = task.target_shift.split(',').map(s => s.trim().toLowerCase())
        if (parts.some(isAll)) return true
    }

    return false
}

/**
 * Check if a task is assigned to a specific team
 */
export const isTaskAssignedToTeam = (task: { target_shifts?: string[]; target_shift?: string | null | any }, teamName: string): boolean => {
    const rawTarget = String(teamName || '').trim().toLowerCase()
    if (!rawTarget) return false
    const withPrefix = `đội ${rawTarget}`.toLowerCase()

    if (isTaskAssignedToAll(task)) return true

    // 1. Check in target_shifts array
    if (Array.isArray(task?.target_shifts) && task.target_shifts.length > 0) {
        return task.target_shifts.some(s => {
            const val = String(s || '').trim().toLowerCase()
            return val === rawTarget || val === withPrefix || val.includes(rawTarget)
        })
    }

    // 2. Check in target_shift (array, comma-separated string, or single string)
    if (Array.isArray(task?.target_shift)) {
        return task.target_shift.some(s => {
            const val = String(s || '').trim().toLowerCase()
            return val === rawTarget || val === withPrefix || val.includes(rawTarget)
        })
    }

    if (typeof task?.target_shift === 'string' && task.target_shift.trim()) {
        const parts = task.target_shift.split(',').map(s => s.trim().toLowerCase())
        return parts.some(p => p === rawTarget || p === withPrefix || p.includes(rawTarget))
    }

    return false
}

/**
 * Lấy danh sách những người đã tiếp nhận của công việc
 * Đã khử trùng lặp (nếu 1 người vừa là người chỉ định vừa là người trong tổ đội, hoặc vừa bấm nhận vừa hoàn thành)
 */
export const getDeduplicatedAcknowledgements = (task: any): {
    user_id: string | null
    user_name: string
    acknowledged_at: string
    is_completed?: boolean
    completed_team?: string | null
    completed_at?: string | null
    team_names?: string[]
}[] => {
    if (!task) return []
    let raw: any[] = []
    if (Array.isArray(task.acknowledgements) && task.acknowledgements.length > 0) {
        raw = task.acknowledgements
    } else if (typeof task.acknowledgements === 'string' && task.acknowledgements.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(task.acknowledgements)
            if (Array.isArray(parsed)) raw = parsed
        } catch {
            raw = []
        }
    } else if (task.acknowledged_by_name) {
        raw = [{
            user_id: task.acknowledged_by ? String(task.acknowledged_by) : null,
            user_name: String(task.acknowledged_by_name),
            acknowledged_at: task.acknowledged_at || task.created_at,
        }]
    }

    const seen = new Set<string>()
    const result: any[] = []

    for (const a of raw) {
        if (!a) continue
        if (typeof a === 'string') {
            const trimmed = a.trim()
            if (trimmed && !seen.has(trimmed.toLowerCase())) {
                seen.add(trimmed.toLowerCase())
                result.push({
                    user_id: null,
                    user_name: trimmed,
                    acknowledged_at: task.created_at ? String(task.created_at) : new Date().toISOString(),
                })
            }
            continue
        }

        const uId = String(a.user_id || '').trim().toLowerCase()
        const uName = String(a.user_name || '').trim().toLowerCase()
        const key = uId || uName
        if (key && !seen.has(key)) {
            seen.add(key)
            result.push({
                ...a,
                user_id: a.user_id ? String(a.user_id) : null,
                user_name: a.user_name ? String(a.user_name) : 'Nhân viên tiếp nhận',
                acknowledged_at: a.acknowledged_at ? String(a.acknowledged_at) : (task.created_at ? String(task.created_at) : new Date().toISOString()),
            })
        }
    }

    return result
}

/**
 * Check if a specific user has acknowledged/confirmed this task
 */
export const hasUserAcknowledged = (
    task: { acknowledgements?: any[]; acknowledged_by?: string | null; acknowledged_by_name?: string | null; acknowledged_at?: string | null; created_at?: string },
    userId?: string | null,
    userName?: string | null
): boolean => {
    if (!userId && !userName) return false

    const acks = getDeduplicatedAcknowledgements(task)
    const normUserId = userId ? String(userId).trim().toLowerCase() : ''
    const normUserName = userName ? String(userName).trim().toLowerCase() : ''

    return acks.some(a => {
        const aId = a.user_id ? String(a.user_id).trim().toLowerCase() : ''
        const aName = a.user_name ? String(a.user_name).trim().toLowerCase() : ''
        return (normUserId && aId && aId === normUserId) ||
               (normUserName && aName && aName === normUserName)
    })
}

/**
 * Kiểm tra xem người dùng hiện tại có thuộc đối tượng nhận việc để bấm tiếp nhận hay không:
 * - Là người được chỉ định đích danh (assigned_to)
 * - Hoặc thuộc vào một trong các đội được giao việc (assignedTeams)
 * - Hoặc công việc giao chung cho toàn ca (không chọn đội nào cụ thể)
 */
export const canUserAcknowledgeTask = (
    task: any,
    profile: any,
    myTeamNames: string[] = [],
    allMembers: { team_id: string | null; user_id: string | null; full_name: string | null }[] = [],
    teams: { id: string; name: string }[] = []
): boolean => {
    if (!task || !profile) return false

    // Nếu công việc đã bị hủy -> không cần nhận nữa
    if (task.status === 'cancelled') return false

    // Đối với công việc bình thường: nếu đã hoàn thành -> không nhận nữa
    // NHƯNG đối với LỜI NHẮC (reminder): bất kỳ thành viên nào chưa tiếp nhận vẫn có quyền bấm tiếp nhận/đã đọc!
    const isReminder = getTaskType(task) === 'reminder'
    if (task.status === 'completed' && !isReminder) return false

    // 1. Nếu là người được chỉ định đích danh -> có quyền tiếp nhận
    const isDesignatedAssignee = Boolean(
        (task.assigned_to && profile.id === task.assigned_to) ||
        (task.assigned_to_name && profile.full_name?.trim().toLowerCase() === task.assigned_to_name.trim().toLowerCase())
    )
    if (isDesignatedAssignee) return true

    // 2. Nếu giao cho Toàn bộ / Tất cả các đội -> bất kỳ ai cũng có quyền tiếp nhận
    if (isTaskAssignedToAll(task)) return true

    // 3. Lấy danh sách các đội được giao việc
    const assignedTeams = getAssignedTeams(task, teams)

    // Nếu không chỉ định đội nào cụ thể (giao chung toàn ca) -> ai trong ca cũng có thể nhận
    if (assignedTeams.length === 0) return true

    // 4. Kiểm tra xem người dùng có thuộc một trong các đội được giao việc hay không
    const userTeamNorms = new Set(
        myTeamNames.map(name => (name || '').toLowerCase().replace(/^đội\s+/, '').trim()).filter(Boolean)
    )

    if (profile.id && allMembers.length > 0 && teams.length > 0) {
        const userMemberships = allMembers.filter(m => m.user_id === profile.id)
        for (const mem of userMemberships) {
            const t = teams.find(team => team.id === mem.team_id)
            if (t?.name) {
                userTeamNorms.add(t.name.toLowerCase().replace(/^đội\s+/, '').trim())
            }
        }
    }

    const belongsToAssignedTeam = assignedTeams.some(assignedTeam => {
        const tNorm = (assignedTeam || '').toLowerCase().replace(/^đội\s+/, '').trim()
        return userTeamNorms.has(tNorm)
    })

    return belongsToAssignedTeam
}

/**
 * Check if a task has been acknowledged by at least one member belonging to a specific team
 */
export const hasTeamAcknowledged = (
    task: { acknowledgements?: any[]; acknowledged_by?: string | null; acknowledged_by_name?: string | null },
    team: { id: string; name: string },
    allMembers: { team_id: string | null; user_id: string | null; full_name: string | null }[] = []
): boolean => {
    if (!task) return false
    const acks: any[] = Array.isArray(task.acknowledgements) ? task.acknowledgements : []
    if (acks.length === 0 && !task.acknowledged_by_name) return false

    const rawTeamName = (team.name || '').trim().toLowerCase()

    // 1. Check if any ack has team_names containing this team name
    for (const ack of acks) {
        if (Array.isArray(ack.team_names)) {
            if (ack.team_names.some((tn: string) => {
                const norm = (tn || '').trim().toLowerCase()
                return norm === rawTeamName || norm.includes(rawTeamName)
            })) {
                return true
            }
        }
    }

    // 2. Cross-reference with all members of this team
    const teamMemberUserIds = new Set(
        allMembers
            .filter(m => m.team_id === team.id && m.user_id)
            .map(m => m.user_id!)
    )
    const teamMemberNames = new Set(
        allMembers
            .filter(m => m.team_id === team.id && m.full_name)
            .map(m => m.full_name!.trim().toLowerCase())
    )

    // If there are registered members for this team, check if any of them acknowledged
    if (teamMemberUserIds.size > 0 || teamMemberNames.size > 0) {
        for (const ack of acks) {
            if (ack.user_id && teamMemberUserIds.has(ack.user_id)) return true
            if (ack.user_name && teamMemberNames.has(ack.user_name.trim().toLowerCase())) return true
        }

        if (task.acknowledged_by && teamMemberUserIds.has(task.acknowledged_by)) return true
        if (task.acknowledged_by_name && teamMemberNames.has(task.acknowledged_by_name.trim().toLowerCase())) return true

        return false
    }

    // Fallback: If this team has NO registered members yet in the database,
    // only consider acknowledged if an ack specifically tagged this team name
    return false
}

/**
 * Lấy danh sách tên các đội được giao trong một task (chuẩn hóa dạng: 'Đội Thống kê', 'Đội Xe nâng cao'...)
 */
export const getAssignedTeams = (
    task: { target_shifts?: string[]; target_shift?: string | null | any },
    allTeamsList?: { id?: string; name: string }[]
): string[] => {
    if (!task) return []
    // Nếu giao cho "Toàn bộ" và có danh sách tất cả các đội -> trả về toàn bộ tên các đội
    if (isTaskAssignedToAll(task) && Array.isArray(allTeamsList) && allTeamsList.length > 0) {
        return allTeamsList.map(t => {
            const trimmed = String(t?.name || '').trim()
            return trimmed.startsWith('Đội ') || trimmed.startsWith('đội ')
                ? 'Đội ' + trimmed.replace(/^[đĐ]ội\s+/, '')
                : `Đội ${trimmed}`
        })
    }

    const rawList: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
        ? task.target_shifts
        : (Array.isArray(task.target_shift)
            ? task.target_shift
            : (typeof task.target_shift === 'string' ? task.target_shift.split(',').map(s => s.trim()).filter(Boolean) : []))

    const teams: string[] = []
    for (const item of rawList) {
        const trimmed = String(item || '').trim()
        if (trimmed.startsWith('Đội ') || trimmed.startsWith('đội ')) {
            // Chuẩn hóa chữ hoa đầu từ: 'Đội Tên'
            const teamName = 'Đội ' + trimmed.slice(4).trim()
            if (!teams.includes(teamName)) {
                teams.push(teamName)
            }
        }
    }
    return teams
}

/**
 * Lấy danh sách các đội đã hoàn thành phần việc của mình
 */
export const getTeamCompletions = (task: any): TeamCompletion[] => {
    if (!task) return []

    // 1. Kiểm tra trường team_completions
    if (Array.isArray(task.team_completions) && task.team_completions.length > 0) {
        return task.team_completions
    }

    // 2. Fallback kiểm tra acknowledgements có đánh dấu completed
    if (Array.isArray(task.acknowledgements)) {
        const fromAcks = task.acknowledgements
            .filter((a: any) => a && (a.is_completed || a.completed_team))
            .map((a: any) => ({
                team_name: a.completed_team || (Array.isArray(a.team_names) && a.team_names[0]) || 'Đội hoàn thành',
                completed_by: a.user_id || null,
                completed_by_name: a.user_name || 'Nhân viên',
                completed_at: a.completed_at || a.acknowledged_at || new Date().toISOString(),
                notes: a.completion_notes || null,
                images: a.completion_images || [],
            }))
        if (fromAcks.length > 0) return fromAcks
    }

    // 3. Fallback: Nếu task đã completed từ trước (legacy)
    if (task.status === 'completed' && task.completed_at) {
        const assignedTeams = getAssignedTeams(task)
        if (assignedTeams.length > 0) {
            return assignedTeams.map(t => ({
                team_name: t,
                completed_by: task.completed_by || null,
                completed_by_name: task.completed_by_name || 'Nhân viên',
                completed_at: task.completed_at,
                notes: task.completion_notes || null,
                images: task.completion_images || [],
            }))
        }
    }

    return []
}

/**
 * Kiểm tra xem một đội cụ thể đã bấm hoàn thành chưa
 */
export const isTeamCompleted = (task: any, teamName: string): boolean => {
    const completions = getTeamCompletions(task)
    const norm = String(teamName || '').toLowerCase().trim().replace(/^đội\s+/, '')
    return completions.some(c => {
        const cNorm = String(c?.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
        return cNorm === norm
    })
}

/**
 * Kiểm tra xem một đội cụ thể đã có thành viên bấm tiếp nhận việc chưa
 */
export const isTeamAcknowledged = (
    task: any,
    teamName: string,
    allMembers: { team_id: string | null; user_id: string | null; full_name: string | null }[] = [],
    teams: { id: string; name: string }[] = []
): boolean => {
    if (!task) return false
    const norm = String(teamName || '').toLowerCase().trim().replace(/^đội\s+/, '')
    const acks = getDeduplicatedAcknowledgements(task)

    // 1. Nếu đội đã hoàn thành thì chắc chắn đã tiếp nhận
    if (isTeamCompleted(task, teamName)) return true

    // 2. Kiểm tra trong team_names của từng lượt xác nhận tiếp nhận
    for (const ack of acks) {
        if (!ack) continue
        if (Array.isArray(ack.team_names)) {
            if (ack.team_names.some((tn: string) => String(tn || '').toLowerCase().trim().replace(/^đội\s+/, '') === norm)) {
                return true
            }
        }
        if (ack.completed_team && String(ack.completed_team).toLowerCase().trim().replace(/^đội\s+/, '') === norm) {
            return true
        }
    }

    // 3. Đối chiếu với danh sách thành viên đội (allMembers và teams)
    if (allMembers.length > 0 && teams.length > 0) {
        const matchedTeam = teams.find(t => String(t?.name || '').toLowerCase().trim().replace(/^đội\s+/, '') === norm)
        if (matchedTeam && hasTeamAcknowledged(task, matchedTeam, allMembers)) {
            return true
        }
    }

    // 4. Nếu chỉ giao cho 1 đội duy nhất và đã có người bấm nhận việc
    const assigned = getAssignedTeams(task)
    if (assigned.length === 1 && acks.length > 0) {
        return true
    }

    return false
}

export interface TeamMemberAckInfo {
    totalMembers: number
    ackedCount: number
    ackedMembers: {
        user_id: string | null
        user_name: string
        acknowledged_at: string
    }[]
    unackedMemberNames: string[]
}

/**
 * Lấy chi tiết thông tin ai trong đội đã tiếp nhận, ai chưa tiếp nhận của 1 task
 */
export const getTeamMemberAckInfo = (
    task: any,
    teamName: string,
    allMembers: { team_id: string | null; user_id: string | null; full_name: string | null }[] = [],
    teams: { id: string; name: string }[] = []
): TeamMemberAckInfo => {
    const norm = String(teamName || '').toLowerCase().trim().replace(/^đội\s+/, '')
    const matchedTeam = teams.find(t => (t.name || '').toLowerCase().trim().replace(/^đội\s+/, '') === norm)

    const teamMembers = matchedTeam
        ? allMembers.filter(m => m.team_id === matchedTeam.id)
        : []

    const acks = getDeduplicatedAcknowledgements(task)

    const ackedMembers: { user_id: string | null; user_name: string; acknowledged_at: string }[] = []
    const seenKeys = new Set<string>()

    for (const ack of acks) {
        if (!ack) continue
        const ackName = String(ack.user_name || '').trim()
        const ackUserId = ack.user_id ? String(ack.user_id) : null

        let belongsToThisTeam = false

        if (Array.isArray(ack.team_names)) {
            if (ack.team_names.some((tn: string) => String(tn || '').toLowerCase().trim().replace(/^đội\s+/, '') === norm)) {
                belongsToThisTeam = true
            }
        }

        if (!belongsToThisTeam && matchedTeam) {
            if (ackUserId && teamMembers.some(m => m.user_id && m.user_id === ackUserId)) {
                belongsToThisTeam = true
            } else if (ackName && teamMembers.some(m => m.full_name && m.full_name.trim().toLowerCase() === ackName.toLowerCase())) {
                belongsToThisTeam = true
            }
        }

        if (!belongsToThisTeam && getAssignedTeams(task).length === 1) {
            belongsToThisTeam = true
        }

        if (belongsToThisTeam) {
            const key = (ackUserId || ackName).toLowerCase()
            if (key && !seenKeys.has(key)) {
                seenKeys.add(key)
                ackedMembers.push({
                    user_id: ackUserId,
                    user_name: ackName || 'Nhân viên tiếp nhận',
                    acknowledged_at: ack.acknowledged_at || task.created_at || new Date().toISOString(),
                })
            }
        }
    }

    const unackedMemberNames = teamMembers
        .filter(m => {
            const name = String(m.full_name || '').trim().toLowerCase()
            const uId = String(m.user_id || '').toLowerCase()
            return (!uId || !seenKeys.has(uId)) && (!name || !seenKeys.has(name))
        })
        .map(m => m.full_name || 'Thành viên')

    return {
        totalMembers: teamMembers.length,
        ackedCount: ackedMembers.length,
        ackedMembers,
        unackedMemberNames,
    }
}

/**
 * Tính toán tiến độ theo từng đội (hỗ trợ phân biệt Lời nhắc vs Công việc)
 */
export const getTaskTeamProgress = (
    task: any,
    allMembers: { team_id: string | null; user_id: string | null; full_name: string | null }[] = [],
    teams: { id: string; name: string }[] = []
): {
    assignedTeams: string[]
    completedTeams: TeamCompletion[]
    total: number
    completedCount: number
    ackedCount: number
    ratioText: string
    percent: number
    isAllCompleted: boolean
    isReminder: boolean
} => {
    const isReminder = getTaskType(task) === 'reminder'
    const assignedTeams = getAssignedTeams(task, teams)
    const completedTeams = getTeamCompletions(task)

    // Nếu không giao cụ thể cho đội nào (giao ca chung): tính tổng là 1
    if (assignedTeams.length === 0) {
        const acks = Array.isArray(task?.acknowledgements) ? task.acknowledgements : []
        // Đối với lời nhắc không gán đội cụ thể: không tự ý hoàn tất chỉ vì 1 người bấm tiếp nhận (acks.length > 0)
        const isDone = task?.status === 'completed'
        return {
            assignedTeams: [],
            completedTeams,
            total: 1,
            completedCount: isDone ? 1 : 0,
            ackedCount: acks.length,
            ratioText: isDone ? '1/1' : `${acks.length} người đã nhận`,
            percent: isDone ? 100 : (acks.length > 0 ? 50 : 0),
            isAllCompleted: isDone,
            isReminder,
        }
    }

    const total = assignedTeams.length
    const validCompleted = assignedTeams.filter(teamName => isTeamCompleted(task, teamName))
    const validAcked = assignedTeams.filter(teamName => isTeamAcknowledged(task, teamName, allMembers, teams))

    // Đối với LỜI NHẮC: tiến độ là số đội ĐÃ TIẾP NHẬN/ĐÃ XEM
    // Đối với CÔNG VIỆC: tiến độ là số đội ĐÃ BÁO HOÀN THÀNH
    const completedCount = isReminder ? validAcked.length : validCompleted.length
    const ackedCount = validAcked.length
    const percent = Math.round((completedCount / total) * 100)
    const isAllCompleted = completedCount >= total || task?.status === 'completed'

    return {
        assignedTeams,
        completedTeams,
        total,
        completedCount,
        ackedCount,
        ratioText: `${completedCount}/${total}`,
        percent,
        isAllCompleted,
        isReminder,
    }
}

/**
 * Kiểm tra xem người dùng có phải là Quản trị viên (Cấp 1 Super Admin, Cấp 2 Quản trị công ty, hoặc role admin) hay không
 */
export const isUserAdmin = (profile: any): boolean => {
    if (!profile) return false

    // 1. Check account_level (1 = Super Admin, 2 = Company Admin)
    if (profile.account_level === 1 || profile.account_level === 2) return true

    // 2. Check email super admin hoặc công ty quản trị
    const email = (profile.email || '').trim().toLowerCase()
    if (email === 'tungdibui2609@gmail.com' || email === 'tungnguyen@chanhthu.com') return true

    // 3. Check role code
    const roleCode = (profile.roles?.code || (profile as any)?.role || '').trim().toLowerCase()
    if (roleCode === 'admin' || roleCode === 'superadmin' || roleCode === 'company_admin') return true

    // 4. Check permissions
    if (Array.isArray(profile.permissions)) {
        if (profile.permissions.includes('system.full_access') || profile.permissions.includes('shift_tasks.admin') || profile.permissions.includes('shift_tasks.delete_all')) {
            return true
        }
    }

    return false
}

/**
 * Kiểm tra xem người dùng có quyền quản lý/xóa công việc (người tạo hoặc quản trị viên cấp 1, cấp 2)
 */
export const canManageTask = (task: any, profile: any): boolean => {
    if (!profile) return false

    // Quản trị viên (Cấp 1 & Cấp 2 Quản trị công ty) có toàn quyền xóa/sửa bất kỳ công việc nào
    if (isUserAdmin(profile)) return true

    if (!task) return false

    // Người tạo công việc
    const isCreator = Boolean(
        (profile.id && task.created_by && profile.id === task.created_by) ||
        (profile.full_name && task.created_by_name && profile.full_name.trim().toLowerCase() === task.created_by_name.trim().toLowerCase())
    )

    return isCreator
}

/**
 * Kiểm tra người dùng hiện tại có quyền bấm hoàn thành cho đội nào trong task này
 */
export const canUserCompleteTeamTask = (
    task: any,
    profile: any,
    myTeamNames: string[] = []
): {
    canComplete: boolean
    eligibleTeams: string[]
    alreadyCompletedTeams: string[]
    isCreatorOrAdmin: boolean
} => {
    const isCreatorOrAdmin = canManageTask(task, profile)

    // Lời nhắc không cần báo hoàn thành, chỉ cần tiếp nhận
    if (getTaskType(task) === 'reminder') {
        return {
            canComplete: false,
            eligibleTeams: [],
            alreadyCompletedTeams: [],
            isCreatorOrAdmin,
        }
    }

    const assignedTeams = getAssignedTeams(task)

    // Kiểm tra nếu công việc có chỉ định đích danh người phụ trách chính (assigned_to hoặc assigned_to_name)
    const hasSpecificAssignee = Boolean(task?.assigned_to || task?.assigned_to_name)
    const isAssignedUser = Boolean(
        profile?.id && (
            (task?.assigned_to && profile.id === task.assigned_to) ||
            (task?.assigned_to_name && profile.full_name?.trim().toLowerCase() === task.assigned_to_name.trim().toLowerCase())
        )
    )

    // Nếu công việc chỉ đích danh 1 người phụ trách chính:
    // CHỈ người đó (hoặc quản trị viên / người giao việc) mới có quyền báo cáo chụp hình hoàn thành
    if (hasSpecificAssignee && !isAssignedUser && !isCreatorOrAdmin) {
        return {
            canComplete: false,
            eligibleTeams: [],
            alreadyCompletedTeams: assignedTeams.filter(team => isTeamCompleted(task, team)),
            isCreatorOrAdmin,
        }
    }

    // Trường hợp 1: Task không giao cho đội cụ thể nào (giao theo Ca)
    if (assignedTeams.length === 0) {
        const isCompleted = task.status === 'completed'
        return {
            canComplete: !isCompleted,
            eligibleTeams: [],
            alreadyCompletedTeams: isCompleted ? ['Tất cả'] : [],
            isCreatorOrAdmin,
        }
    }

    // Trường hợp 2: Giao cho các đội cụ thể
    // Chuẩn hóa tên đội người dùng (đảm bảo có tiền tố 'Đội ')
    const normalizedMyTeams = myTeamNames.map(name => {
        const trimmed = name.trim()
        return (trimmed.startsWith('Đội ') || trimmed.startsWith('đội ')) ? 'Đội ' + trimmed.slice(4).trim() : 'Đội ' + trimmed
    })

    // Các đội được giao mà người dùng có quyền hoàn thành:
    // - Nếu là người được chỉ định đích danh hoặc Admin/Creator: có quyền báo cáo hoàn thành cho các đội được giao trong công việc
    // - Nếu không có người chỉ định riêng: thành viên thuộc đội nào chỉ được hoàn thành cho đội đó
    const candidateTeams = (isCreatorOrAdmin || isAssignedUser)
        ? assignedTeams
        : assignedTeams.filter(team => {
            const tNorm = team.toLowerCase().replace(/^đội\s+/, '').trim()
            return normalizedMyTeams.some(myT => myT.toLowerCase().replace(/^đội\s+/, '').trim() === tNorm)
        })

    const alreadyCompletedTeams = candidateTeams.filter(team => isTeamCompleted(task, team))
    const eligibleTeams = candidateTeams.filter(team => !isTeamCompleted(task, team))

    return {
        canComplete: eligibleTeams.length > 0 && task.status !== 'completed',
        eligibleTeams,
        alreadyCompletedTeams,
        isCreatorOrAdmin,
    }
}

/**
 * Asynchronously dispatches a Web Push Notification for shift tasks
 */
export async function dispatchTaskPushNotification({
    title,
    body,
    targetShifts = [],
    targetUserIds = [],
    targetUserNames = [],
    excludeUserIds = [],
    excludeUserNames = [],
    taskId,
    url = '/work/tasks',
    badgeCount = 1,
}: {
    title: string
    body: string
    targetShifts?: string[]
    targetUserIds?: string[]
    targetUserNames?: string[]
    excludeUserIds?: string[]
    excludeUserNames?: string[]
    taskId?: string | null
    url?: string
    badgeCount?: number
}) {
    try {
        await fetch('/api/notifications/send-push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                body,
                target_shifts: targetShifts,
                target_user_ids: targetUserIds,
                target_user_names: targetUserNames,
                exclude_user_ids: excludeUserIds,
                exclude_user_names: excludeUserNames,
                task_id: taskId || null,
                url,
                badgeCount,
            }),
        })
    } catch (err) {
        console.warn('Failed to dispatch push notification:', err)
    }
}

/**
 * Dispatch push notification for new message / discussion in task
 */
export function dispatchTaskMessageNotification({
    task,
    sender,
    messageText,
    hasImages = false,
}: {
    task: ShiftTask
    sender: { id?: string | null; name?: string | null }
    messageText: string
    hasImages?: boolean
}) {
    const assignedTeams = getAssignedTeams(task)
    const targetUserIds = [task.created_by, task.assigned_to].filter(Boolean) as string[]
    const targetUserNames = [task.created_by_name, task.assigned_to_name].filter(Boolean) as string[]
    const excludeUserIds = sender.id ? [sender.id] : []
    const excludeUserNames = sender.name ? [sender.name] : []

    const cleanMsg = messageText.trim()
    const snippet = cleanMsg
        ? (cleanMsg.length > 75 ? cleanMsg.slice(0, 72) + '...' : cleanMsg)
        : (hasImages ? 'Đã gửi hình ảnh đính kèm 📷' : 'Đã gửi tin nhắn trao đổi mới.')

    const senderDisplayName = sender.name || 'Thành viên'

    dispatchTaskPushNotification({
        title: `💬 [Tin mới] #${task.code} - ${task.title}`,
        body: `${senderDisplayName}: ${snippet}`,
        targetShifts: assignedTeams,
        targetUserIds,
        targetUserNames,
        excludeUserIds,
        excludeUserNames,
        taskId: task.id,
        url: `/work/tasks?taskId=${task.id}`,
    })
}

/**
 * Dispatch push notification when task is reported complete
 */
export function dispatchTaskCompletionNotification({
    task,
    completer,
    completionTeam,
    notes,
    isAllCompleted = false,
}: {
    task: ShiftTask
    completer: { id?: string | null; name?: string | null }
    completionTeam?: string | null
    notes?: string | null
    isAllCompleted?: boolean
}) {
    const assignedTeams = getAssignedTeams(task)
    const targetUserIds = [task.created_by, task.assigned_to].filter(Boolean) as string[]
    const targetUserNames = [task.created_by_name, task.assigned_to_name].filter(Boolean) as string[]
    const excludeUserIds = completer.id ? [completer.id] : []
    const excludeUserNames = completer.name ? [completer.name] : []

    const completerName = completer.name || 'Nhân viên'
    const teamLabel = completionTeam ? ` (${completionTeam})` : ''
    const cleanNotes = (notes || '').trim()
    const noteSnippet = cleanNotes ? `: "${cleanNotes.length > 65 ? cleanNotes.slice(0, 62) + '...' : cleanNotes}"` : '.'

    const title = isAllCompleted
        ? `✅ [ĐÃ HOÀN THÀNH] #${task.code} - ${task.title}`
        : `⚡ [Đội xong việc] #${task.code} - ${task.title}`

    const body = `${completerName}${teamLabel} đã báo cáo hoàn thành${noteSnippet}`

    dispatchTaskPushNotification({
        title,
        body,
        targetShifts: assignedTeams,
        targetUserIds,
        targetUserNames,
        excludeUserIds,
        excludeUserNames,
        taskId: task.id,
        url: `/work/tasks?taskId=${task.id}`,
    })
}




