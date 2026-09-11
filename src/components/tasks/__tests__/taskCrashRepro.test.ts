import { describe, it, expect } from 'vitest'
import {
    getTaskType,
    getAssignedTeams,
    getTaskTeamProgress,
    getTeamMemberAckInfo,
    getDeduplicatedAcknowledgements,
    hasUserAcknowledged,
    hasTeamAcknowledged,
    canUserAcknowledgeTask,
    canUserCompleteTeamTask,
    canManageTask,
    formatDateTime,
    formatDateRelative,
    isTaskAssignedToTeam,
} from '../taskUtils'
import {
    extractInlineImages,
    extractInlineImageUrls,
    getCardContentPreview,
    parseContentWithInlineImages,
} from '../taskContentUtils'

describe('Task crash reproduction & edge cases', () => {
    const baseTask: any = {
        id: 'task-123',
        code: 'CV-260912-418',
        title: 'TTTTTT',
        created_by_name: 'Da Ti',
        created_at: '2026-09-12T02:10:00.000Z',
        updated_at: '2026-09-12T02:10:00.000Z',
        status: 'pending',
        priority: 'normal',
        target_shift: 'Đội Thủ Kho',
        target_shifts: ['Đội Thủ Kho'],
    }

    it('handles null/undefined fields safely', () => {
        expect(() => getTaskType(baseTask)).not.toThrow()
        expect(() => getAssignedTeams(baseTask)).not.toThrow()
        expect(() => getDeduplicatedAcknowledgements(baseTask)).not.toThrow()
        expect(() => getTaskTeamProgress(baseTask, [], [])).not.toThrow()
        expect(() => getTeamMemberAckInfo(baseTask, 'Đội Thủ Kho', [], [])).not.toThrow()
    })

    it('handles target_shift when it is an array or object instead of string', () => {
        const weirdTask = {
            ...baseTask,
            target_shift: ['Đội Thủ Kho'] as any,
            target_shifts: null as any,
        }
        expect(() => isTaskAssignedToTeam(weirdTask, 'Thủ Kho')).not.toThrow()
        expect(() => getAssignedTeams(weirdTask)).not.toThrow()

        // Simulate ShiftTasksView line 348 and 1153, TaskDetailModal line 555
        const parseShifts = (t: any) => {
            return Array.isArray(t.target_shifts) && t.target_shifts.length > 0
                ? t.target_shifts
                : (typeof t.target_shift === 'string' ? t.target_shift.split(',').map((s: string) => s.trim()).filter(Boolean) : Array.isArray(t.target_shift) ? t.target_shift : [])
        }
        expect(() => parseShifts(weirdTask)).not.toThrow()
    })

    it('handles target_shift when null or empty', () => {
        const weirdTask = {
            ...baseTask,
            target_shift: null,
            target_shifts: null,
        }
        expect(() => isTaskAssignedToTeam(weirdTask, 'Thủ Kho')).not.toThrow()
        expect(() => getAssignedTeams(weirdTask)).not.toThrow()
    })

    it('handles acknowledgements when string or unexpected structure', () => {
        const weirdTask = {
            ...baseTask,
            acknowledgements: 'not an array' as any,
        }
        expect(() => getDeduplicatedAcknowledgements(weirdTask)).not.toThrow()
        expect(() => hasUserAcknowledged(weirdTask, 'u1', 'Da Ti')).not.toThrow()
        expect(() => hasTeamAcknowledged(weirdTask, { id: 't1', name: 'Thủ Kho' }, [])).not.toThrow()
        expect(() => getTaskTeamProgress(weirdTask, [], [])).not.toThrow()
        expect(() => getTeamMemberAckInfo(weirdTask, 'Đội Thủ Kho', [], [])).not.toThrow()
    })

    it('handles acknowledgements containing raw string or object without user_name', () => {
        const weirdTask = {
            ...baseTask,
            acknowledgements: ['just a string', { user_id: 123 }, null] as any,
        }
        expect(() => getDeduplicatedAcknowledgements(weirdTask)).not.toThrow()
        expect(() => hasUserAcknowledged(weirdTask, 'u1', 'Da Ti')).not.toThrow()
        expect(() => getTeamMemberAckInfo(weirdTask, 'Đội Thủ Kho', [], [])).not.toThrow()
    })

    it('handles edit_history and completion_images when they are strings instead of arrays', () => {
        const weirdTask = {
            ...baseTask,
            edit_history: '[{"edited_by_name":"Admin","changes":["Sửa"]}]' as any,
            completion_images: '["https://example.com/img.jpg"]' as any,
        }

        const renderHistory = (t: any) => {
            const list = Array.isArray(t.edit_history) ? t.edit_history : []
            return list.map((e: any) => e.edited_by_name)
        }
        expect(() => renderHistory(weirdTask)).not.toThrow()

        // And what currently happens if task.edit_history.map is called:
        expect(() => {
            if (weirdTask.edit_history && weirdTask.edit_history.length > 0) {
                (weirdTask.edit_history as any).map((e: any) => e)
            }
        }).toThrow('weirdTask.edit_history.map is not a function')
    })
})
