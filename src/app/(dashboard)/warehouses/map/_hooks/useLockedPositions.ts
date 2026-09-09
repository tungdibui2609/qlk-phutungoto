import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/components/ui/ToastProvider'

interface UseLockedPositionsProps {
    systemType: string | null
    initialModules?: any
}

export function useLockedPositions({ systemType, initialModules }: UseLockedPositionsProps) {
    const { showToast } = useToast()
    const storageKey = useMemo(() => {
        return `warehouse_locked_positions_${systemType || 'default'}`
    }, [systemType])

    // Load initial state from initialModules or localStorage
    const [lockedPositionIds, setLockedPositionIds] = useState<Set<string>>(() => {
        if (initialModules?.locked_position_ids && Array.isArray(initialModules.locked_position_ids)) {
            return new Set(initialModules.locked_position_ids)
        }
        if (typeof window === 'undefined') return new Set()
        try {
            const raw = localStorage.getItem(`warehouse_locked_positions_${systemType || 'default'}`)
            if (raw) {
                const arr = JSON.parse(raw)
                if (Array.isArray(arr)) return new Set(arr)
            }
        } catch (e) {
            console.error('Error loading locked positions from localStorage:', e)
        }
        return new Set()
    })

    // Helper to persist to localStorage and sync state
    const saveLockedIds = useCallback((newSet: Set<string>) => {
        setLockedPositionIds(newSet)
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(Array.from(newSet)))
            } catch (e) {
                console.error('Error saving locked positions to localStorage:', e)
            }
        }
    }, [storageKey])

    // Fetch and sync from backend API
    const syncFromBackend = useCallback(async () => {
        if (!systemType) return
        try {
            const res = await fetch(`/api/warehouses/positions/lock?systemCode=${encodeURIComponent(systemType)}`)
            if (res.ok) {
                const data = await res.json()
                if (Array.isArray(data.lockedPositionIds)) {
                    saveLockedIds(new Set(data.lockedPositionIds))
                }
            }
        } catch (e) {
            console.warn('Could not sync locked positions from API, using local cache:', e)
        }
    }, [systemType, saveLockedIds])

    // Sync when systemType changes
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = localStorage.getItem(storageKey)
            if (raw) {
                const arr = JSON.parse(raw)
                if (Array.isArray(arr)) {
                    setLockedPositionIds(new Set(arr))
                }
            }
        } catch (e) {
            console.error('Error reading localStorage for locked positions:', e)
        }
        syncFromBackend()
    }, [storageKey, syncFromBackend])

    // Listen to storage event to sync across browser tabs
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                try {
                    const arr = event.newValue ? JSON.parse(event.newValue) : []
                    setLockedPositionIds(new Set(Array.isArray(arr) ? arr : []))
                } catch (e) {
                    console.error('Error handling storage event for locked positions:', e)
                }
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [storageKey])

    // Check if position is locked
    const isLocked = useCallback((idOrIds: string | string[]): boolean => {
        if (Array.isArray(idOrIds)) {
            return idOrIds.some(id => lockedPositionIds.has(id))
        }
        return lockedPositionIds.has(idOrIds)
    }, [lockedPositionIds])

    // Toggle lock
    const toggleLock = useCallback(async (idOrIds: string | string[]) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (ids.length === 0) return

        const allLocked = ids.every(id => lockedPositionIds.has(id))
        const next = new Set(lockedPositionIds)

        if (allLocked) {
            ids.forEach(id => next.delete(id))
            saveLockedIds(next)
            showToast(`Đã mở khóa ${ids.length} vị trí`, 'info')
        } else {
            ids.forEach(id => next.add(id))
            saveLockedIds(next)
            showToast(`Đã khóa ${ids.length} vị trí (không thể gán hàng, không tính thống kê)`, 'success')
        }

        // Call background API to persist in database
        if (systemType) {
            try {
                await fetch('/api/warehouses/positions/lock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemCode: systemType,
                        positionIds: ids,
                        action: allLocked ? 'unlock' : 'lock'
                    })
                })
            } catch (e) {
                console.error('Error saving locked positions to API:', e)
            }
        }
    }, [lockedPositionIds, saveLockedIds, showToast, systemType])

    return {
        lockedPositionIds,
        isLocked,
        toggleLock,
        refreshLockedPositions: syncFromBackend
    }
}
