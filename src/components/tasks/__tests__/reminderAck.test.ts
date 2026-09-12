import { describe, it, expect } from 'vitest'
import {
    isTaskAssignedToAll,
    getAssignedTeams,
    getTaskTeamProgress,
    canUserAcknowledgeTask,
    hasUserAcknowledged,
    getTaskType,
} from '../taskUtils'

describe('Reminder Acknowledgment Logic for All Teams', () => {
    const sampleTeams = [
        { id: 't1', name: 'Đội Xe Nâng Cao' },
        { id: 't2', name: 'Đội Thống Kê' },
        { id: 't3', name: 'Đội Soạn Hàng' },
    ]

    const reminderTask: any = {
        id: 'reminder-1',
        code: 'LN-260913-403',
        title: 'Kích hoạt thông báo',
        task_type: 'reminder',
        target_shifts: ['Toàn bộ'],
        status: 'pending',
        acknowledgements: [],
    }

    it('identifies task assigned to all teams correctly', () => {
        expect(isTaskAssignedToAll(reminderTask)).toBe(true)
        expect(isTaskAssignedToAll({ target_shift: 'Toàn ca' })).toBe(true)
        expect(isTaskAssignedToAll({ target_shifts: ['Đội Xe Nâng Cao'] })).toBe(false)
    })

    it('expands assignedTeams to all teams when assigned to Toan Bo', () => {
        const assigned = getAssignedTeams(reminderTask, sampleTeams)
        expect(assigned).toEqual(['Đội Xe Nâng Cao', 'Đội Thống Kê', 'Đội Soạn Hàng'])
    })

    it('does not mark reminder as all completed when only 1 user acknowledges', () => {
        const taskWith1Ack = {
            ...reminderTask,
            acknowledgements: [
                { user_id: 'u1', user_name: 'Nhân viên 1', acknowledged_at: new Date().toISOString() },
            ],
        }

        const progressWithTeams = getTaskTeamProgress(taskWith1Ack, [], sampleTeams)
        expect(progressWithTeams.isAllCompleted).toBe(false)
        expect(progressWithTeams.total).toBe(3)

        // Without teams list passed:
        const progressWithoutTeams = getTaskTeamProgress(taskWith1Ack, [], [])
        expect(progressWithoutTeams.isAllCompleted).toBe(false)
        expect(progressWithoutTeams.ackedCount).toBe(1)
    })

    it('allows remaining users to acknowledge even if task status is completed', () => {
        const completedReminder: any = {
            ...reminderTask,
            status: 'completed',
            completed_by_name: 'Các đội đã tiếp nhận',
            acknowledgements: [
                { user_id: 'u1', user_name: 'Nhân viên 1' },
            ],
        }

        const user1Profile = { id: 'u1', full_name: 'Nhân viên 1' }
        const user2Profile = { id: 'u2', full_name: 'Nhân viên 2' }

        expect(hasUserAcknowledged(completedReminder, user1Profile.id, user1Profile.full_name)).toBe(true)
        expect(hasUserAcknowledged(completedReminder, user2Profile.id, user2Profile.full_name)).toBe(false)

        // User 2 must still be able to acknowledge this reminder
        const canUser2Ack = canUserAcknowledgeTask(completedReminder, user2Profile, [], [], sampleTeams)
        expect(canUser2Ack).toBe(true)

        // But for a normal task (task_type: 'task'), completed task should return false
        const normalCompletedTask = { ...completedReminder, task_type: 'task', code: 'CV-260913-001' }
        const canUser2AckNormal = canUserAcknowledgeTask(normalCompletedTask, user2Profile, [], [], sampleTeams)
        expect(canUser2AckNormal).toBe(false)
    })

    it('treats reminder as unacknowledged for a specific user if they have not acknowledged, even if task status is completed', () => {
        const completedReminder: any = {
            ...reminderTask,
            status: 'completed',
            completed_by_name: 'Các đội đã tiếp nhận',
            acknowledgements: [
                { user_id: 'u1', user_name: 'Nhân viên 1' },
            ],
        }

        const isUser2Acked = hasUserAcknowledged(completedReminder, 'u2', 'Nhân viên 2')
        expect(isUser2Acked).toBe(false)

        // For user 2, it is still pending
        const isReminder = getTaskType(completedReminder) === 'reminder'
        const isUser2Pending = isReminder
            ? !isUser2Acked
            : (completedReminder.status !== 'completed' && !isUser2Acked)

        expect(isUser2Pending).toBe(true)
    })
})
