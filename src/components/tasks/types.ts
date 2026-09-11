export type TaskPriority = 'urgent' | 'important' | 'normal'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'

export interface TaskAcknowledgement {
    user_id: string | null
    user_name: string | null
    acknowledged_at: string
}

export interface TaskEditHistoryEntry {
    edited_by: string | null
    edited_by_name: string | null
    edited_at: string
    changes: string[]
    previous_snapshot?: {
        title: string
        content: string | null
        priority: TaskPriority
        target_shift: string | null
        images: string[]
    }
}

export interface TeamCompletion {
    team_name: string
    completed_by: string | null
    completed_by_name: string | null
    completed_at: string
    notes?: string | null
    images?: string[]
}

export interface ShiftTask {
    id: string
    code: string
    system_code: string
    company_id: string | null
    title: string
    content: string | null
    priority: TaskPriority
    status: TaskStatus
    target_shift: string | null
    target_shifts?: string[]
    assigned_to: string | null
    assigned_to_name: string | null
    images: string[]
    created_by: string | null
    created_by_name: string | null
    acknowledged_by: string | null
    acknowledged_by_name: string | null
    acknowledged_at: string | null
    acknowledgements?: TaskAcknowledgement[]
    edit_history?: TaskEditHistoryEntry[]
    completed_by: string | null
    completed_by_name: string | null
    completed_at: string | null
    completion_notes: string | null
    completion_images: string[]
    team_completions?: TeamCompletion[]
    created_at: string
    updated_at: string
    // Virtual or joined fields
    messages_count?: number
}

export interface ShiftTaskMessage {
    id: string
    task_id: string
    company_id: string | null
    user_id: string | null
    user_name: string | null
    message: string
    images: string[]
    created_at: string
}
