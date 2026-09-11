/**
 * Utility functions for Shift Tasks
 */

import { TeamCompletion, ShiftTask } from './types'

export const compressImageFile = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
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
    // 1. First compress the image to save bandwidth and storage
    const compressedDataUrl = await compressImageFile(file)

    // 2. Try to upload via API if available, otherwise return compressedDataUrl
    try {
        const formData = new FormData()
        formData.append('file', file)
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
    } catch {
        // Fallback silently to compressedDataUrl
    }

    return compressedDataUrl
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

export const generateTaskCode = (): string => {
    const d = new Date()
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const rand = Math.floor(100 + Math.random() * 900)
    return `NV-${yy}${mm}${dd}-${rand}`
}

/**
 * Check if a task is assigned to a specific team
 */
export const isTaskAssignedToTeam = (task: { target_shifts?: string[]; target_shift?: string | null }, teamName: string): boolean => {
    const rawTarget = (teamName || '').trim().toLowerCase()
    if (!rawTarget) return false
    const withPrefix = `đội ${rawTarget}`.toLowerCase()

    // 1. Check in target_shifts array
    if (Array.isArray(task.target_shifts) && task.target_shifts.length > 0) {
        return task.target_shifts.some(s => {
            const val = (s || '').trim().toLowerCase()
            return val === rawTarget || val === withPrefix || val.includes(rawTarget)
        })
    }

    // 2. Check in target_shift comma-separated or single string
    if (task.target_shift) {
        const parts = task.target_shift.split(',').map(s => s.trim().toLowerCase())
        return parts.some(p => p === rawTarget || p === withPrefix || p.includes(rawTarget))
    }

    return false
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

    const acks: any[] = Array.isArray(task.acknowledgements) && task.acknowledgements.length > 0
        ? task.acknowledgements
        : (task.acknowledged_by_name ? [{ user_id: task.acknowledged_by, user_name: task.acknowledged_by_name, acknowledged_at: task.acknowledged_at || task.created_at }] : [])

    return acks.some(a => 
        (userId && a.user_id && a.user_id === userId) ||
        (userName && a.user_name && a.user_name.trim().toLowerCase() === userName.trim().toLowerCase())
    )
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
export const getAssignedTeams = (task: { target_shifts?: string[]; target_shift?: string | null }): string[] => {
    if (!task) return []
    const rawList: string[] = Array.isArray(task.target_shifts) && task.target_shifts.length > 0
        ? task.target_shifts
        : (task.target_shift ? task.target_shift.split(',').map(s => s.trim()).filter(Boolean) : [])

    const teams: string[] = []
    for (const item of rawList) {
        const trimmed = item.trim()
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
    const norm = teamName.toLowerCase().trim().replace(/^đội\s+/, '')
    return completions.some(c => {
        const cNorm = (c.team_name || '').toLowerCase().trim().replace(/^đội\s+/, '')
        return cNorm === norm
    })
}

/**
 * Tính toán tiến độ hoàn thành theo từng đội (VD: 1/2, 2/3...)
 */
export const getTaskTeamProgress = (task: any): {
    assignedTeams: string[]
    completedTeams: TeamCompletion[]
    total: number
    completedCount: number
    ratioText: string
    percent: number
    isAllCompleted: boolean
} => {
    const assignedTeams = getAssignedTeams(task)
    const completedTeams = getTeamCompletions(task)

    // Nếu không giao cụ thể cho đội nào (giao ca chung): tính tổng là 1
    if (assignedTeams.length === 0) {
        const isDone = task?.status === 'completed'
        return {
            assignedTeams: [],
            completedTeams,
            total: 1,
            completedCount: isDone ? 1 : 0,
            ratioText: isDone ? '1/1' : '0/1',
            percent: isDone ? 100 : 0,
            isAllCompleted: isDone,
        }
    }

    const total = assignedTeams.length
    // Số đội đã hoàn thành hợp lệ (nằm trong assignedTeams)
    const validCompleted = assignedTeams.filter(teamName => isTeamCompleted(task, teamName))
    const completedCount = validCompleted.length
    const percent = Math.round((completedCount / total) * 100)
    const isAllCompleted = completedCount >= total || task?.status === 'completed'

    return {
        assignedTeams,
        completedTeams,
        total,
        completedCount,
        ratioText: `${completedCount}/${total}`,
        percent,
        isAllCompleted,
    }
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
    const isCreatorOrAdmin = Boolean(
        profile?.id === task.created_by ||
        (profile?.full_name && task.created_by_name === profile.full_name) ||
        profile?.roles?.code === 'admin' ||
        (profile as any)?.role === 'admin'
    )

    const assignedTeams = getAssignedTeams(task)

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

    // Các đội được giao mà người dùng thuộc về (hoặc tất cả nếu là admin/creator)
    const candidateTeams = isCreatorOrAdmin
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



