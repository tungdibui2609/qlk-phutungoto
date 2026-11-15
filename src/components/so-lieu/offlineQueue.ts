import { supabase } from '@/lib/supabaseClient'

export interface WebOfflineAction {
    id: string
    type: 'CREATE_SHIFT' | 'SUBMIT_JOURNAL' | 'UPDATE_JOURNAL' | 'DELETE_JOURNAL' | 'CLOSE_SHIFT'
    payload: any
    shiftId?: string
    timestamp: number
}

export const getWebOfflineQueue = (sysCode: string): WebOfflineAction[] => {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(`solieu_web_queue_${sysCode}`)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

export const saveWebOfflineQueue = (sysCode: string, queue: WebOfflineAction[]) => {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(`solieu_web_queue_${sysCode}`, JSON.stringify(queue))
    } catch (e) {
        console.warn('Lỗi lưu offline queue web:', e)
    }
}

export const flushWebOfflineQueue = async (
    shiftSystemCode: string
): Promise<{ syncedCount: number; remainingCount: number }> => {
    const queue = getWebOfflineQueue(shiftSystemCode)
    if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 }

    const tempShiftIdMap: Record<string, string> = {}
    const remainingQueue: WebOfflineAction[] = []
    let syncedCount = 0

    for (const action of queue) {
        try {
            if (action.type === 'CREATE_SHIFT') {
                const { insertPayload, tempShiftId } = action.payload
                const { data: realShift, error } = await (supabase as any)
                    .from('delivery_shifts')
                    .insert([insertPayload])
                    .select()
                    .single()
                if (error) throw error
                if (realShift) {
                    tempShiftIdMap[tempShiftId] = realShift.id
                    syncedCount++
                }
            } else if (action.type === 'SUBMIT_JOURNAL') {
                const origPayload = action.payload
                const shiftId = action.shiftId || ''
                const realShiftId = tempShiftIdMap[shiftId] || shiftId
                let finalNotes = origPayload.notes || ''
                if (shiftId && finalNotes.includes(shiftId)) {
                    finalNotes = finalNotes.replace(`[CV_ID: ${shiftId}]`, `[CV_ID: ${realShiftId}]`)
                }
                const payload = {
                    ...origPayload,
                    notes: finalNotes,
                }
                const { error } = await (supabase as any)
                    .from('delivery_journal')
                    .insert([payload])
                if (error) throw error
                syncedCount++
            } else if (action.type === 'UPDATE_JOURNAL') {
                const { id, payload } = action.payload
                const { error } = await (supabase as any)
                    .from('delivery_journal')
                    .update(payload)
                    .eq('id', id)
                if (error) throw error
                syncedCount++
            } else if (action.type === 'DELETE_JOURNAL') {
                const { id } = action.payload
                const { error } = await (supabase as any)
                    .from('delivery_journal')
                    .delete()
                    .eq('id', id)
                if (error) throw error
                syncedCount++
            } else if (action.type === 'CLOSE_SHIFT') {
                const { payload, shiftId } = action.payload
                const realShiftId = tempShiftIdMap[shiftId] || shiftId
                const { error } = await (supabase as any)
                    .from('delivery_shifts')
                    .update(payload)
                    .eq('id', realShiftId)
                if (error) throw error
                syncedCount++
            }
        } catch (err: any) {
            console.warn('Lỗi sync action web:', action.type, err?.message)
            remainingQueue.push(action)
        }
    }

    saveWebOfflineQueue(shiftSystemCode, remainingQueue)
    return { syncedCount, remainingCount: remainingQueue.length }
}
