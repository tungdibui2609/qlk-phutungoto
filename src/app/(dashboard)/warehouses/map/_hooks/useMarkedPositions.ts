import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/components/ui/ToastProvider'
import { exportMarkedPositionsToExcel } from '@/lib/warehouseExcelExport'

interface UseMarkedPositionsProps {
    systemType: string | null
    systemName?: string
}

export function useMarkedPositions({ systemType, systemName }: UseMarkedPositionsProps) {
    const { showToast, showConfirm } = useToast()
    const storageKey = useMemo(() => {
        return `warehouse_marked_positions_${systemType || 'default'}`
    }, [systemType])

    // Load initial state from localStorage
    const [markedPositionIds, setMarkedPositionIds] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set()
        try {
            const raw = localStorage.getItem(`warehouse_marked_positions_${systemType || 'default'}`)
            if (raw) {
                const arr = JSON.parse(raw)
                if (Array.isArray(arr)) return new Set(arr)
            }
        } catch (e) {
            console.error('Error loading marked positions:', e)
        }
        return new Set()
    })

    // Filter toggle
    const [onlyShowMarked, setOnlyShowMarked] = useState<boolean>(false)

    // Sync from localStorage when storageKey changes
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = localStorage.getItem(storageKey)
            if (raw) {
                const arr = JSON.parse(raw)
                if (Array.isArray(arr)) {
                    setMarkedPositionIds(new Set(arr))
                    return
                }
            }
            setMarkedPositionIds(new Set())
        } catch (e) {
            console.error('Error loading marked positions on key change:', e)
        }
    }, [storageKey])

    // Listen to storage event to sync across browser tabs
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                try {
                    const arr = event.newValue ? JSON.parse(event.newValue) : []
                    setMarkedPositionIds(new Set(Array.isArray(arr) ? arr : []))
                } catch (e) {
                    console.error('Error handling storage event for marked positions:', e)
                }
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [storageKey])

    // Persist helper
    const saveMarkedIds = useCallback((newSet: Set<string>) => {
        setMarkedPositionIds(newSet)
        try {
            localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)))
        } catch (e) {
            console.error('Error saving marked positions:', e)
        }
    }, [storageKey])

    // Check if position is marked
    const isMarked = useCallback((idOrIds: string | string[]): boolean => {
        if (Array.isArray(idOrIds)) {
            return idOrIds.some(id => markedPositionIds.has(id))
        }
        return markedPositionIds.has(idOrIds)
    }, [markedPositionIds])

    // Toggle mark
    const toggleMark = useCallback((idOrIds: string | string[]) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (ids.length === 0) return

        const allMarked = ids.every(id => markedPositionIds.has(id))
        const next = new Set(markedPositionIds)

        if (allMarked) {
            ids.forEach(id => next.delete(id))
            saveMarkedIds(next)
            showToast(`Đã bỏ đánh dấu ${ids.length} vị trí`, 'info')
        } else {
            ids.forEach(id => next.add(id))
            saveMarkedIds(next)
            showToast(`Đã đánh dấu ${ids.length} vị trí để kiểm tra`, 'success')
        }
    }, [markedPositionIds, saveMarkedIds, showToast])

    // Explicit mark
    const markPositions = useCallback((ids: string[]) => {
        if (!ids.length) return
        const next = new Set(markedPositionIds)
        ids.forEach(id => next.add(id))
        saveMarkedIds(next)
        showToast(`Đã đánh dấu ${ids.length} vị trí`, 'success')
    }, [markedPositionIds, saveMarkedIds, showToast])

    // Explicit unmark
    const unmarkPositions = useCallback((ids: string[]) => {
        if (!ids.length) return
        const next = new Set(markedPositionIds)
        ids.forEach(id => next.delete(id))
        saveMarkedIds(next)
        showToast(`Đã bỏ đánh dấu ${ids.length} vị trí`, 'info')
    }, [markedPositionIds, saveMarkedIds, showToast])

    // Clear all marks
    const clearAllMarks = useCallback(async () => {
        if (markedPositionIds.size === 0) return
        if (await showConfirm(`Bạn có chắc chắn muốn xóa toàn bộ ${markedPositionIds.size} vị trí đã đánh dấu?`)) {
            saveMarkedIds(new Set())
            setOnlyShowMarked(false)
            showToast('Đã xóa toàn bộ đánh dấu', 'success')
        }
    }, [markedPositionIds.size, saveMarkedIds, showConfirm, showToast])

    // Toggle filter mode
    const toggleOnlyShowMarked = useCallback(() => {
        if (!onlyShowMarked && markedPositionIds.size === 0) {
            showToast('Chưa có vị trí nào được đánh dấu. Hãy click menu trên ô hoặc tích chọn ô để đánh dấu vị trí kiểm tra.', 'warning')
            return
        }
        setOnlyShowMarked(prev => !prev)
    }, [onlyShowMarked, markedPositionIds.size, showToast])

    // Export marked positions to Excel
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
                zones
            })
            showToast(`Đã xuất Excel thành công cho ${markedPositions.length} vị trí`, 'success')
        } catch (e: any) {
            console.error('Error exporting marked positions to Excel:', e)
            showToast('Lỗi khi xuất file Excel: ' + (e?.message || 'Không xác định'), 'error')
        }
    }, [markedPositionIds, systemName, showToast])

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
        markedCount: markedPositionIds.size,
        isMarked,
        toggleMark,
        markPositions,
        unmarkPositions,
        clearAllMarks,
        onlyShowMarked,
        setOnlyShowMarked,
        toggleOnlyShowMarked,
        exportMarkedExcel,
        printMarked
    }
}
