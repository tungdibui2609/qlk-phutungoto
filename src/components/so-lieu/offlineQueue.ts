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

const mergePinnedProducts = (serverPinned: any, localPinned: any): any[] | undefined => {
    const sArr = Array.isArray(serverPinned) ? serverPinned : []
    const lArr = Array.isArray(localPinned) ? localPinned : []
    if (!Array.isArray(serverPinned) && !Array.isArray(localPinned)) return undefined

    const seen = new Set<string>()
    const merged: any[] = []
    const getKey = (item: any) =>
        item?.id ? `id:${item.id}` : `sku:${item?.sku || ''}::name:${item?.name || ''}`

    for (const item of [...sArr, ...lArr]) {
        if (!item) continue
        const key = getKey(item)
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(item)
    }
    return merged
}

const mergeReconcileSessions = (serverRecs: any, localRecs: any): any => {
    if (!serverRecs && !localRecs) return undefined
    if (Array.isArray(serverRecs) || Array.isArray(localRecs)) {
        const sArr = Array.isArray(serverRecs) ? serverRecs : []
        const lArr = Array.isArray(localRecs) ? localRecs : []
        const map = new Map<string, any>()
        for (const item of [...sArr, ...lArr]) {
            if (!item) continue
            const key = String(item.key || item.id || Math.random())
            const prev = map.get(key)
            if (!prev) {
                map.set(key, item)
            } else {
                const prevTs = new Date(prev.updated_at || 0).getTime()
                const curTs = new Date(item.updated_at || 0).getTime()
                map.set(key, curTs >= prevTs ? item : prev)
            }
        }
        return Array.from(map.values())
    }
    if (typeof serverRecs === 'object' || typeof localRecs === 'object') {
        return { ...(serverRecs || {}), ...(localRecs || {}) }
    }
    return localRecs ?? serverRecs
}

const fetchAndMergeWebShiftSummary = async (
    realShiftId: string,
    localSummary: any
): Promise<{ mergedSummary: Record<string, any>; serverStatus?: string }> => {
    const { data: serverShift } = await (supabase as any)
        .from('delivery_shifts')
        .select('id, status, system_code, summary_data')
        .eq('id', realShiftId)
        .maybeSingle()

    const serverSummary = serverShift?.summary_data || {}
    const mergedPinned = mergePinnedProducts(serverSummary.pinned_products, localSummary?.pinned_products)
    const mergedRecs = mergeReconcileSessions(serverSummary.reconciliations, localSummary?.reconciliations)

    const mergedSummary: Record<string, any> = {
        ...serverSummary,
        ...(localSummary || {}),
    }
    if (mergedPinned !== undefined) mergedSummary.pinned_products = mergedPinned
    if (mergedRecs !== undefined) mergedSummary.reconciliations = mergedRecs

    const shiftSys = serverShift?.system_code
    const baseSys = shiftSys?.endsWith('__solieu') ? shiftSys.slice(0, -8) : shiftSys
    let q = (supabase as any)
        .from('delivery_journal')
        .select('id, item_name, unit, quantity_sent, to_department')
        .ilike('notes', `%[CV_ID: ${realShiftId}]%`)
    if (shiftSys) {
        q = baseSys && baseSys !== shiftSys
            ? q.in('system_code', [shiftSys, baseSys])
            : q.eq('system_code', shiftSys)
    }
    const { data: journalRows, error: jErr } = await q
    if (!jErr && Array.isArray(journalRows)) {
        const productsSummary: Record<
            string,
            { product_name: string; unit: string; in_qty: number; out_qty: number; count: number }
        > = {}
        const unitsSummary: Record<string, { in_qty: number; out_qty: number; count: number }> = {}

        for (const r of journalRows) {
            const pName = (r.item_name || 'Sản phẩm').trim()
            const uName = (r.unit || 'Thùng').trim()
            const key = `${pName}___${uName}`
            const qty = Number(r.quantity_sent) || 0
            const isIn = r.to_department === 'Kho'

            if (!productsSummary[key]) {
                productsSummary[key] = { product_name: pName, unit: uName, in_qty: 0, out_qty: 0, count: 0 }
            }
            if (isIn) {
                productsSummary[key].in_qty = Number((productsSummary[key].in_qty + qty).toFixed(2))
            } else {
                productsSummary[key].out_qty = Number((productsSummary[key].out_qty + qty).toFixed(2))
            }
            productsSummary[key].count += 1

            if (!unitsSummary[uName]) {
                unitsSummary[uName] = { in_qty: 0, out_qty: 0, count: 0 }
            }
            if (isIn) {
                unitsSummary[uName].in_qty = Number((unitsSummary[uName].in_qty + qty).toFixed(2))
            } else {
                unitsSummary[uName].out_qty = Number((unitsSummary[uName].out_qty + qty).toFixed(2))
            }
            unitsSummary[uName].count += 1
        }

        mergedSummary.products_summary = productsSummary
        mergedSummary.units_summary = unitsSummary
        mergedSummary.total_records = journalRows.length
    }

    return { mergedSummary, serverStatus: serverShift?.status }
}

export const flushWebOfflineQueue = async (
    shiftSystemCode: string
): Promise<{ syncedCount: number; remainingCount: number }> => {
    const queue = getWebOfflineQueue(shiftSystemCode)
    if (queue.length === 0) return { syncedCount: 0, remainingCount: 0 }

    const tempShiftIdMap: Record<string, string> = {}
    const remainingQueue: WebOfflineAction[] = []
    let syncedCount = 0
    const touchedShiftIds = new Set<string>()
    const closedInSync = new Set<string>()

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
                if (realShiftId) touchedShiftIds.add(String(realShiftId))
                syncedCount++
            } else if (action.type === 'UPDATE_JOURNAL') {
                const { id, payload } = action.payload
                const { error } = await (supabase as any)
                    .from('delivery_journal')
                    .update(payload)
                    .eq('id', id)
                if (error) throw error
                const rawShiftId = action.shiftId || action.payload?.shiftId
                const realShiftId = rawShiftId ? tempShiftIdMap[rawShiftId] || rawShiftId : null
                if (realShiftId) touchedShiftIds.add(String(realShiftId))
                syncedCount++
            } else if (action.type === 'DELETE_JOURNAL') {
                const { id } = action.payload
                const { error } = await (supabase as any)
                    .from('delivery_journal')
                    .delete()
                    .eq('id', id)
                if (error) throw error
                const rawShiftId = action.shiftId || action.payload?.shiftId
                const realShiftId = rawShiftId ? tempShiftIdMap[rawShiftId] || rawShiftId : null
                if (realShiftId) touchedShiftIds.add(String(realShiftId))
                syncedCount++
            } else if (action.type === 'CLOSE_SHIFT') {
                const { payload, shiftId } = action.payload
                const realShiftId = tempShiftIdMap[shiftId] || shiftId
                const { mergedSummary } = await fetchAndMergeWebShiftSummary(
                    realShiftId,
                    payload?.summary_data
                )
                const { error } = await (supabase as any)
                    .from('delivery_shifts')
                    .update({ ...payload, summary_data: mergedSummary })
                    .eq('id', realShiftId)
                if (error) throw error
                closedInSync.add(String(realShiftId))
                syncedCount++
            }
        } catch (err: any) {
            console.warn('Lỗi sync action web:', action.type, err?.message)
            remainingQueue.push(action)
        }
    }

    for (const sId of Array.from(touchedShiftIds)) {
        if (closedInSync.has(sId) || sId.startsWith('offline_')) continue
        try {
            const { mergedSummary, serverStatus } = await fetchAndMergeWebShiftSummary(sId, null)
            if (serverStatus === 'closed') {
                await (supabase as any)
                    .from('delivery_shifts')
                    .update({ summary_data: mergedSummary })
                    .eq('id', sId)
            }
        } catch (err: any) {
            console.warn('Lỗi cập nhật tổng kết ca sau sync web:', sId, err?.message)
        }
    }

    saveWebOfflineQueue(shiftSystemCode, remainingQueue)
    return { syncedCount, remainingCount: remainingQueue.length }
}
