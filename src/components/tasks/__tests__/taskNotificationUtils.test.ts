import { describe, it, expect, vi } from 'vitest'
import {
    dispatchTaskPushNotification,
    dispatchTaskMessageNotification,
    dispatchTaskCompletionNotification,
} from '../taskUtils'
import { ShiftTask } from '../types'

describe('Task Notification Dispatchers', () => {
    const sampleTask: ShiftTask = {
        id: 'task-123',
        code: 'LN-260911-347',
        system_code: 'sanxuat',
        company_id: null,
        title: 'Kiểm tra khay xoài',
        content: 'Nội dung kiểm tra',
        status: 'in_progress',
        priority: 'urgent',
        target_shift: 'Đội Ghép kho, Đội Thống kê',
        target_shifts: ['Đội Ghép kho', 'Đội Thống kê'],
        assigned_to: 'user-assignee-2',
        assigned_to_name: 'Trần Thị Nhận',
        images: [],
        created_by: 'user-creator-1',
        created_by_name: 'Nguyễn Văn Tạo',
        acknowledged_by: null,
        acknowledged_by_name: null,
        acknowledged_at: null,
        completed_by: null,
        completed_by_name: null,
        completed_at: null,
        completion_notes: null,
        completion_images: [],
        created_at: '2026-09-11T10:00:00Z',
        updated_at: '2026-09-11T10:00:00Z',
    }

    it('dispatches message push notification with correct targets and exclusions', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchSpy)

        dispatchTaskMessageNotification({
            task: sampleTask,
            sender: { id: 'user-chat-3', name: 'Lê Văn Chat' },
            messageText: 'đang bị kẹt đường phải dọn',
            hasImages: false,
        })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('/api/notifications/send-push')
        
        const body = JSON.parse(options.body)
        expect(body.title).toBe('💬 [Tin mới] #LN-260911-347 - Kiểm tra khay xoài')
        expect(body.body).toContain('Lê Văn Chat: đang bị kẹt đường phải dọn')
        expect(body.target_shifts).toEqual(['Đội Ghép kho', 'Đội Thống kê'])
        expect(body.target_user_ids).toEqual(['user-creator-1', 'user-assignee-2'])
        expect(body.target_user_names).toEqual(['Nguyễn Văn Tạo', 'Trần Thị Nhận'])
        expect(body.exclude_user_ids).toEqual(['user-chat-3'])
        expect(body.exclude_user_names).toEqual(['Lê Văn Chat'])
        expect(body.task_id).toBe('task-123')

        vi.unstubAllGlobals()
    })

    it('dispatches completion push notification with team name and notes', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('fetch', fetchSpy)

        dispatchTaskCompletionNotification({
            task: sampleTask,
            completer: { id: 'user-assignee-2', name: 'Trần Thị Nhận' },
            completionTeam: 'Đội Ghép kho',
            notes: 'Đã hoàn tất dọn sạch đường đi',
            isAllCompleted: true,
        })

        expect(fetchSpy).toHaveBeenCalledTimes(1)
        const [url, options] = fetchSpy.mock.calls[0]
        expect(url).toBe('/api/notifications/send-push')

        const body = JSON.parse(options.body)
        expect(body.title).toBe('✅ [ĐÃ HOÀN THÀNH] #LN-260911-347 - Kiểm tra khay xoài')
        expect(body.body).toContain('Trần Thị Nhận (Đội Ghép kho) đã báo cáo hoàn thành: "Đã hoàn tất dọn sạch đường đi"')
        expect(body.target_shifts).toEqual(['Đội Ghép kho', 'Đội Thống kê'])
        expect(body.target_user_ids).toEqual(['user-creator-1', 'user-assignee-2'])
        expect(body.exclude_user_ids).toEqual(['user-assignee-2'])

        vi.unstubAllGlobals()
    })
})
