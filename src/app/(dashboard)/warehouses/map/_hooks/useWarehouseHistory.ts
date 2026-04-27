'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'

export interface HistoryPosition {
    position_id: string
    code: string | null
    lot_id: string | null
    lot_code: string | null
    zone_id: string | null
}

export interface SnapshotDate {
    snapshot_date: string
    position_count: number
}

export interface HistoryComparison {
    changes: Record<string, {
        change_type: 'added' | 'removed' | 'changed' | 'unchanged' | 'new_position'
        current_lot_id: string | null
        current_lot_code: string | null
        history_lot_id: string | null
        history_lot_code: string | null
        position_code: string
    }>
    summary: {
        total: number
        added: number
        removed: number
        changed: number
        unchanged: number
        new_position: number
    }
}

export function useWarehouseHistory() {
    const { currentSystem } = useSystem()
    const [historyLoading, setHistoryLoading] = useState(false)
    const [datesLoading, setDatesLoading] = useState(false)
    const [captureLoading, setCaptureLoading] = useState(false)
    const [historyPositions, setHistoryPositions] = useState<HistoryPosition[]>([])
    const [snapshotDates, setSnapshotDates] = useState<SnapshotDate[]>([])

    /**
     * Lấy danh sách ngày có snapshot
     */
    const fetchSnapshotDates = useCallback(async (): Promise<SnapshotDate[]> => {
        setDatesLoading(true)
        try {
            const { data, error } = await (supabase as any).rpc('get_snapshot_dates', {
                p_system_code: currentSystem?.code || 'default'
            })

            if (error) {
                const errorMsg = error?.message || error?.details || error?.hint
                    || (typeof error === 'object' ? JSON.stringify(error) : String(error))
                console.error('Supabase RPC error (get_snapshot_dates):', error)
                throw new Error(errorMsg || 'Không thể lấy danh sách ngày snapshot')
            }
            const result = (data || []) as SnapshotDate[]
            setSnapshotDates(result)
            return result
        } catch (e: any) {
            const msg = e?.message || String(e) || 'Lỗi không xác định'
            console.error('Error fetching snapshot dates:', msg)
            throw e
        } finally {
            setDatesLoading(false)
        }
    }, [currentSystem?.code])

    /**
     * Chụp snapshot trạng thái hiện tại vào bảng position_history
     */
    const captureSnapshot = useCallback(async (): Promise<void> => {
        setCaptureLoading(true)
        try {
            const { data, error } = await (supabase as any).rpc('capture_daily_position_snapshot')

            if (error) {
                // PostgrestError may have non-enumerable properties → JSON.stringify yields {}
                const code = (error as any).code
                const message = (error as any).message
                const details = (error as any).details
                const hint = (error as any).hint

                const errorMsg = code
                    ? `[${code}] ${message || ''}${details ? ' - ' + details : ''}${hint ? ' (Hint: ' + hint + ')' : ''}`
                    : (message || details || hint || JSON.stringify(error))
                console.error('Supabase RPC error details:', { code, message, details, hint, raw: error })
                throw new Error(errorMsg || 'Không thể chụp snapshot - lỗi RPC không xác định. Có thể migration chưa được áp dụng.')
            }
        } catch (e: any) {
            const msg = e?.message || String(e) || 'Lỗi không xác định'
            console.error('Error capturing snapshot:', msg)
            // Re-throw with proper message
            throw e instanceof Error ? e : new Error(msg)
        } finally {
            setCaptureLoading(false)
        }
    }, [])

    /**
     * Lấy lịch sử vị trí của một ngày cụ thể
     */
    const fetchHistory = useCallback(async (snapshotDate: string): Promise<HistoryPosition[]> => {
        setHistoryLoading(true)
        try {
            const { data, error } = await (supabase as any).rpc('get_position_history', {
                p_system_code: currentSystem?.code || 'default',
                p_snapshot_date: snapshotDate
            })

            if (error) {
                const errorMsg = error?.message || error?.details || error?.hint
                    || (typeof error === 'object' ? JSON.stringify(error) : String(error))
                console.error('Supabase RPC error (get_position_history):', error)
                throw new Error(errorMsg || 'Không thể lấy lịch sử vị trí')
            }
            const result = (data || []) as HistoryPosition[]
            setHistoryPositions(result)
            return result
        } catch (e: any) {
            const msg = e?.message || String(e) || 'Lỗi không xác định'
            console.error('Error fetching position history:', msg)
            throw e
        } finally {
            setHistoryLoading(false)
        }
    }, [currentSystem?.code])

    /**
     * So sánh vị trí lịch sử với trạng thái hiện tại
     */
    const compareWithCurrent = useCallback((
        historyData: HistoryPosition[],
        currentPositions: Array<{ id: string; lot_id: string | null; code: string; lot_code?: string | null }>
    ): HistoryComparison => {
        const historyMap = new Map<string, HistoryPosition>()
        historyData.forEach(item => {
            historyMap.set(item.position_id, item)
        })

        const currentMap = new Map<string, any>()
        currentPositions.forEach(pos => {
            currentMap.set(pos.id, pos)
        })

        const allPositionIds = new Set([
            ...historyMap.keys(),
            ...currentMap.keys()
        ])

        const result: HistoryComparison = {
            changes: {},
            summary: { total: 0, added: 0, removed: 0, changed: 0, unchanged: 0, new_position: 0 }
        }

        allPositionIds.forEach(positionId => {
            const histItem = historyMap.get(positionId)
            const currPos = currentMap.get(positionId)

            const histLotId = histItem?.lot_id || null
            const currLotId = currPos?.lot_id || null

            let changeType: 'added' | 'removed' | 'changed' | 'unchanged' | 'new_position'

            if (!histItem && currPos) {
                changeType = 'new_position' // Vị trí mới thêm (chưa có trong lịch sử)
            } else if (histItem && !currPos) {
                changeType = 'removed' // Vị trí đã bị xóa
            } else if (!histLotId && currLotId) {
                changeType = 'added' // Mới thêm LOT vào (trước đây trống)
            } else if (histLotId && !currLotId) {
                changeType = 'removed' // Đã xóa LOT (trước đây có)
            } else if (histLotId && currLotId && histLotId !== currLotId) {
                changeType = 'changed' // Đổi LOT khác
            } else {
                changeType = 'unchanged' // Không thay đổi
            }

            result.changes[positionId] = {
                change_type: changeType,
                current_lot_id: currLotId || null,
                current_lot_code: currPos?.lot_code || null,
                history_lot_id: histLotId || null,
                history_lot_code: histItem?.lot_code || null,
                position_code: histItem?.code || currPos?.code || positionId
            }

            result.summary.total++
            if (changeType === 'new_position') result.summary.new_position++
            else if (changeType === 'added') result.summary.added++
            else if (changeType === 'removed') result.summary.removed++
            else if (changeType === 'changed') result.summary.changed++
            else result.summary.unchanged++
        })

        return result
    }, [])

    return {
        historyPositions,
        snapshotDates,
        historyLoading,
        datesLoading,
        captureLoading,
        fetchSnapshotDates,
        captureSnapshot,
        fetchHistory,
        compareWithCurrent
    }
}