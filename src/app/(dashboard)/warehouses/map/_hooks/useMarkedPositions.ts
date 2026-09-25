import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/components/ui/ToastProvider'
import { exportMarkedPositionsToExcel } from '@/lib/warehouseExcelExport'

interface UseMarkedPositionsProps {
    systemType: string | null
    systemName?: string
    initialModules?: any
}

function parseStoredMarkedData(raw: string | null): { ids: Set<string>; notes: Record<string, string> } {
    if (!raw) return { ids: new Set(), notes: {} }
    try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
            return { ids: new Set(parsed), notes: {} }
        } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.ids)) {
                return {
                    ids: new Set(parsed.ids),
                    notes: parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {}
                }
            } else {
                const ids = new Set<string>()
                const notes: Record<string, string> = {}
                Object.entries(parsed).forEach(([id, val]) => {
                    ids.add(id)
                    if (typeof val === 'string') notes[id] = val
                    else if (val && typeof val === 'object' && 'note' in val) notes[id] = (val as any).note || ''
                })
                return { ids, notes }
            }
        }
    } catch (e) {
        console.error('Error parsing stored marked positions:', e)
    }
    return { ids: new Set(), notes: {} }
}

function parseModulesMarkedData(rawMarked: any): { ids: Set<string>; notes: Record<string, string> } {
    if (!rawMarked) return { ids: new Set(), notes: {} }
    const ids = new Set<string>()
    const notes: Record<string, string> = {}
    if (Array.isArray(rawMarked)) {
        rawMarked.forEach((id: string) => {
            ids.add(id)
            notes[id] = ''
        })
    } else if (typeof rawMarked === 'object' && rawMarked !== null) {
        Object.entries(rawMarked).forEach(([id, val]) => {
            ids.add(id)
            if (typeof val === 'string') {
                notes[id] = val
            } else if (typeof val === 'object' && val !== null && 'note' in val) {
                notes[id] = (val as any).note || ''
            }
        })
    }
    return { ids, notes }
}

export function useMarkedPositions({ systemType, systemName, initialModules }: UseMarkedPositionsProps) {
    const { showToast, showConfirm } = useToast()
    const storageKey = useMemo(() => {
        return `warehouse_marked_positions_${systemType || 'default'}`
    }, [systemType])

    // Load initial state
    const [markedPositionIds, setMarkedPositionIds] = useState<Set<string>>(() => {
        if (initialModules?.marked_positions) {
            return parseModulesMarkedData(initialModules.marked_positions).ids
        }
        if (typeof window === 'undefined') return new Set()
        return parseStoredMarkedData(localStorage.getItem(`warehouse_marked_positions_${systemType || 'default'}`)).ids
    })

    const [markedNotes, setMarkedNotes] = useState<Record<string, string>>(() => {
        if (initialModules?.marked_positions) {
            return parseModulesMarkedData(initialModules.marked_positions).notes
        }
        if (typeof window === 'undefined') return {}
        return parseStoredMarkedData(localStorage.getItem(`warehouse_marked_positions_${systemType || 'default'}`)).notes
    })

    // Filter toggle
    const [onlyShowMarked, setOnlyShowMarked] = useState<boolean>(false)

    // Save helper
    const saveMarkedState = useCallback((newSet: Set<string>, newNotes: Record<string, string>) => {
        setMarkedPositionIds(newSet)
        setMarkedNotes(newNotes)
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify({
                    ids: Array.from(newSet),
                    notes: newNotes
                }))
            } catch (e) {
                console.error('Error saving marked positions:', e)
            }
        }
    }, [storageKey])

    // Sync from backend API
    const syncFromBackend = useCallback(async () => {
        if (!systemType) return
        try {
            const res = await fetch(`/api/warehouses/positions/mark?systemCode=${encodeURIComponent(systemType)}`)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data.markedPositionIds)) {
                    saveMarkedState(new Set(data.markedPositionIds), data.markedNotes || {})
                }
            }
        } catch (e) {
            console.warn('Could not sync marked positions from API, using local cache:', e)
        }
    }, [systemType, saveMarkedState])

    // Sync from localStorage on storageKey change
    useEffect(() => {
        if (typeof window === 'undefined') return
        const loaded = parseStoredMarkedData(localStorage.getItem(storageKey))
        setMarkedPositionIds(loaded.ids)
        setMarkedNotes(loaded.notes)
        syncFromBackend()
    }, [storageKey, syncFromBackend])

    // Listen to storage event to sync across browser tabs
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                const loaded = parseStoredMarkedData(event.newValue)
                setMarkedPositionIds(loaded.ids)
                setMarkedNotes(loaded.notes)
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [storageKey])

    // Background server call helper
    const callBackendApi = useCallback((action: 'mark' | 'unmark' | 'update_note' | 'clear', positionIds?: string[], note?: string, notes?: Record<string, string>) => {
        if (!systemType) return
        fetch('/api/warehouses/positions/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemCode: systemType,
                positionIds,
                action,
                note,
                notes
            })
        }).catch(e => console.error('Error syncing marked positions with server:', e))
    }, [systemType])

    // Check if position is marked
    const isMarked = useCallback((idOrIds: string | string[]): boolean => {
        if (Array.isArray(idOrIds)) {
            return idOrIds.some(id => markedPositionIds.has(id))
        }
        return markedPositionIds.has(idOrIds)
    }, [markedPositionIds])

    // Get note for a position
    const getMarkNote = useCallback((id: string): string => {
        return markedNotes[id] || ''
    }, [markedNotes])

    // Toggle mark
    const toggleMark = useCallback((idOrIds: string | string[], note?: string) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (ids.length === 0) return

        const allMarked = ids.every(id => markedPositionIds.has(id))
        const nextIds = new Set(markedPositionIds)
        const nextNotes = { ...markedNotes }

        if (allMarked) {
            ids.forEach(id => {
                nextIds.delete(id)
                delete nextNotes[id]
            })
            saveMarkedState(nextIds, nextNotes)
            callBackendApi('unmark', ids)
            showToast(`Đã bỏ đánh dấu ${ids.length} vị trí`, 'info')
        } else {
            ids.forEach(id => {
                nextIds.add(id)
                if (note !== undefined) {
                    nextNotes[id] = note
                }
            })
            saveMarkedState(nextIds, nextNotes)
            callBackendApi('mark', ids, note)
            showToast(`Đã đánh dấu ${ids.length} vị trí để kiểm tra`, 'success')
        }
    }, [markedPositionIds, markedNotes, saveMarkedState, callBackendApi, showToast])

    // Explicit mark with note
    const markPositions = useCallback((ids: string[], note?: string) => {
        if (!ids.length) return
        const nextIds = new Set(markedPositionIds)
        const nextNotes = { ...markedNotes }

        ids.forEach(id => {
            nextIds.add(id)
            if (note !== undefined) {
                nextNotes[id] = note
            }
        })

        saveMarkedState(nextIds, nextNotes)
        callBackendApi('mark', ids, note)
        showToast(note ? `Đã đánh dấu ${ids.length} vị trí: "${note}"` : `Đã đánh dấu ${ids.length} vị trí`, 'success')
    }, [markedPositionIds, markedNotes, saveMarkedState, callBackendApi, showToast])

    // Explicit unmark
    const unmarkPositions = useCallback((ids: string[]) => {
        if (!ids.length) return
        const nextIds = new Set(markedPositionIds)
        const nextNotes = { ...markedNotes }

        ids.forEach(id => {
            nextIds.delete(id)
            delete nextNotes[id]
        })

        saveMarkedState(nextIds, nextNotes)
        callBackendApi('unmark', ids)
        showToast(`Đã bỏ đánh dấu ${ids.length} vị trí`, 'info')
    }, [markedPositionIds, markedNotes, saveMarkedState, callBackendApi, showToast])

    // Update note for already marked positions
    const updateMarkNote = useCallback((idOrIds: string | string[], note: string) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (!ids.length) return

        const nextIds = new Set(markedPositionIds)
        const nextNotes = { ...markedNotes }

        ids.forEach(id => {
            nextIds.add(id)
            nextNotes[id] = note
        })

        saveMarkedState(nextIds, nextNotes)
        callBackendApi('update_note', ids, note)
        showToast(`Đã cập nhật ghi chú đánh dấu cho ${ids.length} vị trí`, 'success')
    }, [markedPositionIds, markedNotes, saveMarkedState, callBackendApi, showToast])

    // Clear all marks
    const clearAllMarks = useCallback(async () => {
        if (markedPositionIds.size === 0) return
        if (await showConfirm(`Bạn có chắc chắn muốn xóa toàn bộ ${markedPositionIds.size} vị trí đã đánh dấu?`)) {
            saveMarkedState(new Set(), {})
            callBackendApi('clear')
            setOnlyShowMarked(false)
            showToast('Đã xóa toàn bộ đánh dấu', 'success')
        }
    }, [markedPositionIds.size, saveMarkedState, callBackendApi, showConfirm, showToast])

    // Toggle filter mode
    const toggleOnlyShowMarked = useCallback(() => {
        if (!onlyShowMarked && markedPositionIds.size === 0) {
            showToast('Chưa có vị trí nào được đánh dấu. Hãy click menu trên ô hoặc tích chọn ô để đánh dấu vị trí kiểm tra.', 'warning')
            return
        }
        setOnlyShowMarked(prev => !prev)
    }, [onlyShowMarked, markedPositionIds.size, showToast])

    // Export marked positions to Excel with notes
    const exportMarkedExcel = useCallback(async (
        allPositions: any[],
        lotInfo: Record<string, any>,
        zones: any[] = []
    ) => {
        if (markedPositionIds.size === 0) {
            showToast('Chưa có vị trí nào được đánh dấu để xuất Excel', 'warning')
            return
        }

        const markedPositions = allPositions.filter(p => {
            if (markedPositionIds.has(p.id)) return true
            const realIds = (p as any).realIds
            return realIds && Array.isArray(realIds) && realIds.some((id: string) => markedPositionIds.has(id))
        })

        if (markedPositions.length === 0) {
            showToast('Không tìm thấy dữ liệu vị trí tương ứng', 'warning')
            return
        }

        try {
            await exportMarkedPositionsToExcel({
                systemName: systemName || 'Kho',
                positions: markedPositions,
                lotInfo,
                zones,
                markedNotes
            })
            showToast(`Đã xuất Excel thành công cho ${markedPositions.length} vị trí`, 'success')
        } catch (e: any) {
            console.error('Error exporting marked positions to Excel:', e)
            showToast('Lỗi khi xuất file Excel: ' + (e?.message || 'Không xác định'), 'error')
        }
    }, [markedPositionIds, markedNotes, systemName, showToast])

    // Print marked diagram
    const printMarked = useCallback(() => {
        if (markedPositionIds.size === 0) {
            showToast('Chưa có vị trí nào được đánh dấu để in', 'warning')
            return
        }
        const params = new URLSearchParams()
        if (systemType) params.set('systemType', systemType)
        params.set('onlyMarked', 'true')
        window.open(`/print/warehouse-map?${params.toString()}`, '_blank')
    }, [markedPositionIds.size, systemType, showToast])

    return {
        markedPositionIds,
        markedNotes,
        markedCount: markedPositionIds.size,
        isMarked,
        getMarkNote,
        toggleMark,
        markPositions,
        unmarkPositions,
        updateMarkNote,
        clearAllMarks,
        onlyShowMarked,
        setOnlyShowMarked,
        toggleOnlyShowMarked,
        exportMarkedExcel,
        printMarked,
        refreshMarkedPositions: syncFromBackend
    }
}
