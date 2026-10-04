import { useState, useEffect, useCallback, useMemo } from 'react'
import { useToast } from '@/components/ui/ToastProvider'
import { LoosePositionConfig } from '@/app/api/warehouses/positions/loose/route'

interface UseLoosePositionsProps {
    systemType: string | null
    initialModules?: any
}

function parseStoredLooseData(raw: string | null): Record<string, LoosePositionConfig> {
    if (!raw) return {}
    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed
        }
    } catch (e) {
        console.error('Error parsing stored loose positions:', e)
    }
    return {}
}

export function useLoosePositions({ systemType, initialModules }: UseLoosePositionsProps) {
    const { showToast } = useToast()
    const storageKey = useMemo(() => {
        return `warehouse_loose_positions_${systemType || 'default'}`
    }, [systemType])

    // Load initial state
    const [loosePositions, setLoosePositions] = useState<Record<string, LoosePositionConfig>>(() => {
        if (initialModules?.loose_positions && typeof initialModules.loose_positions === 'object') {
            return initialModules.loose_positions
        }
        if (typeof window === 'undefined') return {}
        return parseStoredLooseData(localStorage.getItem(`warehouse_loose_positions_${systemType || 'default'}`))
    })

    // Save helper
    const saveLooseState = useCallback((newMap: Record<string, LoosePositionConfig>) => {
        setLoosePositions(newMap)
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify(newMap))
            } catch (e) {
                console.error('Error saving loose positions to localStorage:', e)
            }
        }
    }, [storageKey])

    // Sync from backend API
    const syncFromBackend = useCallback(async () => {
        if (!systemType) return
        try {
            const res = await fetch(`/api/warehouses/positions/loose?systemCode=${encodeURIComponent(systemType)}`)
            if (res.ok) {
                const data = await res.json()
                if (data.loosePositions && typeof data.loosePositions === 'object') {
                    saveLooseState(data.loosePositions)
                }
            }
        } catch (e) {
            console.warn('Could not sync loose positions from API, using local cache:', e)
        }
    }, [systemType, saveLooseState])

    // Sync when systemType changes
    useEffect(() => {
        if (typeof window === 'undefined') return
        const loaded = parseStoredLooseData(localStorage.getItem(storageKey))
        setLoosePositions(loaded)
        syncFromBackend()
    }, [storageKey, syncFromBackend])

    // Cross-tab synchronization
    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) {
                const loaded = parseStoredLooseData(event.newValue)
                setLoosePositions(loaded)
            }
        }
        window.addEventListener('storage', handleStorage)
        return () => window.removeEventListener('storage', handleStorage)
    }, [storageKey])

    const isLoose = useCallback((posId: string): boolean => {
        return !!loosePositions[posId]
    }, [loosePositions])

    const getLooseConfig = useCallback((posId: string): LoosePositionConfig | undefined => {
        return loosePositions[posId]
    }, [loosePositions])

    // Configure loose positions
    const setLoose = useCallback(async (
        posIds: string[],
        config: { productId?: string | null; productName: string; sku?: string | null; isClosed: boolean; note?: string }
    ) => {
        if (!posIds.length) return
        const next = { ...loosePositions }
        const now = new Date().toISOString()
        posIds.forEach(id => {
            next[id] = {
                productId: config.productId || null,
                productName: config.productName || 'Hàng lẻ',
                sku: config.sku || null,
                isClosed: config.isClosed,
                note: config.note || '',
                updatedAt: now
            }
        })
        saveLooseState(next)
        showToast(`Đã thiết lập ${posIds.length} ô hàng lẻ: "${config.productName}"`, 'success')

        if (systemType) {
            try {
                await fetch('/api/warehouses/positions/loose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemCode: systemType,
                        positionIds: posIds,
                        action: 'set',
                        config
                    })
                })
            } catch (e) {
                console.error('Error saving loose positions to API:', e)
            }
        }
    }, [loosePositions, saveLooseState, showToast, systemType])

    // Toggle status (open = included in inventory, closed = excluded from inventory)
    const toggleLooseStatus = useCallback(async (idOrIds: string | string[], targetStatus?: boolean) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (!ids.length) return

        const next = { ...loosePositions }
        let anyClosed = false
        ids.forEach(id => {
            if (next[id]) {
                const newClosed = targetStatus !== undefined ? targetStatus : !next[id].isClosed
                next[id] = {
                    ...next[id],
                    isClosed: newClosed,
                    updatedAt: new Date().toISOString()
                }
                if (newClosed) anyClosed = true
            }
        })
        saveLooseState(next)

        const statusMsg = anyClosed
            ? `Đã ĐÓNG ${ids.length} ô hàng lẻ (tạm ẩn khỏi báo cáo tồn kho)`
            : `Đã MỞ ${ids.length} ô hàng lẻ (tính vào báo cáo tồn kho chốt sổ)`
        showToast(statusMsg, anyClosed ? 'info' : 'success')

        if (systemType) {
            try {
                await fetch('/api/warehouses/positions/loose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemCode: systemType,
                        positionIds: ids,
                        action: 'toggle_status',
                        isClosed: targetStatus
                    })
                })
            } catch (e) {
                console.error('Error updating loose status to API:', e)
            }
        }
    }, [loosePositions, saveLooseState, showToast, systemType])

    // Set all loose positions open or closed (for month-end inventory check)
    const setAllLooseStatus = useCallback(async (isClosed: boolean) => {
        const allIds = Object.keys(loosePositions)
        if (!allIds.length) {
            showToast('Chưa có ô hàng lẻ nào được thiết lập', 'info')
            return
        }

        const next = { ...loosePositions }
        const now = new Date().toISOString()
        allIds.forEach(id => {
            next[id] = {
                ...next[id],
                isClosed,
                updatedAt: now
            }
        })
        saveLooseState(next)

        const msg = isClosed
            ? `Đã ĐÓNG toàn bộ (${allIds.length}) ô hàng lẻ (tạm ẩn khỏi báo cáo tồn kho)`
            : `Đã MỞ toàn bộ (${allIds.length}) ô hàng lẻ (tính vào báo cáo tồn kho chốt sổ tháng)`
        showToast(msg, isClosed ? 'info' : 'success')

        if (systemType) {
            try {
                await fetch('/api/warehouses/positions/loose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemCode: systemType,
                        action: 'set_all_status',
                        isClosed
                    })
                })
            } catch (e) {
                console.error('Error saving all loose status to API:', e)
            }
        }
    }, [loosePositions, saveLooseState, showToast, systemType])

    // Remove loose positions
    const removeLoose = useCallback(async (idOrIds: string | string[]) => {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
        if (!ids.length) return

        const next = { ...loosePositions }
        ids.forEach(id => {
            delete next[id]
        })
        saveLooseState(next)
        showToast(`Đã hủy thiết lập ${ids.length} ô hàng lẻ`, 'info')

        if (systemType) {
            try {
                await fetch('/api/warehouses/positions/loose', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemCode: systemType,
                        positionIds: ids,
                        action: 'remove'
                    })
                })
            } catch (e) {
                console.error('Error removing loose positions from API:', e)
            }
        }
    }, [loosePositions, saveLooseState, showToast, systemType])

    return {
        loosePositions,
        isLoose,
        getLooseConfig,
        setLoose,
        toggleLooseStatus,
        setAllLooseStatus,
        removeLoose,
        refreshLoosePositions: syncFromBackend
    }
}
