'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { logActivity } from '@/lib/audit'

interface UseMapPositionMovementsParams {
    positions: any[]
    setPositions: React.Dispatch<React.SetStateAction<any[]>>
    zones: any[]
    occupiedIds: Set<string>
    lockedPositionIds: Set<string>
    selectedPositionIds: Set<string>
    setSelectedPositionIds: React.Dispatch<React.SetStateAction<Set<string>>>
    assignLot: { id: string; code: string } | null
    assignLotId: string | null
    isMoveMode: boolean
    currentSystem: any
    systemType: string | null | undefined
    profile: any
    fetchData: () => Promise<any> | void
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
    router: any
    setIsSelectHallOpen: (open: boolean) => void
    setIsMoveModalOpen: (open: boolean) => void
    setIsAutoAssignModalOpen: (open: boolean) => void
}

export function useMapPositionMovements({
    positions,
    setPositions,
    zones,
    occupiedIds,
    lockedPositionIds,
    selectedPositionIds,
    setSelectedPositionIds,
    assignLot,
    assignLotId,
    isMoveMode,
    currentSystem,
    systemType,
    profile,
    fetchData,
    showToast,
    router,
    setIsSelectHallOpen,
    setIsMoveModalOpen,
    setIsAutoAssignModalOpen,
}: UseMapPositionMovementsParams) {
    const selectedPositions = useMemo(() => {
        return positions.filter(p => selectedPositionIds.has(p.id))
    }, [positions, selectedPositionIds])

    const selectedLotIds = useMemo(() => {
        const lotIds = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIds.add(p.lot_id)
        })
        return lotIds
    }, [selectedPositions])

    async function updatePositionsWithLog(updates: { id: string; lot_id: string | null }[]) {
        const chunkSize = 15
        const results: any[] = []

        for (let i = 0; i < updates.length; i += chunkSize) {
            const chunk = updates.slice(i, i + chunkSize)
            const chunkRes = await Promise.all(
                chunk.map(async (u) => {
                    const oldLotId = positions.find(p => p.id === u.id)?.lot_id || null
                    const res = await (supabase.from('positions') as any).update({ lot_id: u.lot_id }).eq('id', u.id)
                    if (res.error) {
                        console.error('Lỗi cập nhật lot_id vị trí:', res.error)
                        throw res.error
                    }
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: u.id,
                        action: 'UPDATE',
                        oldData: { lot_id: oldLotId },
                        newData: { lot_id: u.lot_id },
                        systemCode: currentSystem?.code || ''
                    })
                    return res
                })
            )
            results.push(...chunkRes)
        }
        return results
    }

    function handlePositionSelect(positionIdOrIds: string | string[]) {
        const targetIds = Array.isArray(positionIdOrIds) ? positionIdOrIds : [positionIdOrIds]

        if (assignLot && assignLotId) {
            if (targetIds.some(id => lockedPositionIds.has(id))) {
                showToast('Vị trí này đã bị khóa, không thể gán hàng.', 'warning')
                return
            }

            if (isMoveMode) {
                const positionId = targetIds[0]
                if (occupiedIds.has(positionId)) {
                    showToast('Vị trí này đã có hàng, vui lòng chọn một vị trí trống khác.', 'warning')
                    return
                }

                const oldPositions = positions.filter(p => p.lot_id === assignLotId)
                const clearOld = oldPositions.map(p => ({ id: p.id, lot_id: null }))
                const assignNew = targetIds.map(id => ({ id, lot_id: assignLotId }))

                setPositions(prev => prev.map(p => {
                    if (oldPositions.some(o => o.id === p.id)) return { ...p, lot_id: null }
                    if (targetIds.includes(p.id)) return { ...p, lot_id: assignLotId }
                    return p
                }))

                ;(async () => {
                    try {
                        if (clearOld.length > 0) await updatePositionsWithLog(clearOld)
                        if (assignNew.length > 0) await updatePositionsWithLog(assignNew)
                        showToast('Đã dời vị trí thành công!', 'success')
                        router.push('/warehouses/map')
                    } catch (err: any) {
                        showToast('Có lỗi xảy ra khi dời vị trí: ' + (err.message || 'Không xác định'), 'error')
                        fetchData()
                    }
                })()

                return
            }

            // Normal Assignment Mode (Toggle)
            const firstPos = positions.find(p => p.id === targetIds[0])
            const isAssignedToThisLot = firstPos?.lot_id === assignLotId
            const newLotId = isAssignedToThisLot ? null : assignLotId

            setPositions(prev => prev.map(p =>
                targetIds.includes(p.id) ? { ...p, lot_id: newLotId } : p
            ))

            updatePositionsWithLog(targetIds.map(id => ({ id, lot_id: newLotId }))).then(results => {
                const hasError = results.some(r => r.error)
                if (hasError) {
                    showToast('Có lỗi xảy ra khi cập nhật vị trí', 'error')
                    fetchData()
                }
            })
        } else {
            // Multi-select toggle
            setSelectedPositionIds(prev => {
                const next = new Set(prev)
                const allSelected = targetIds.every(id => next.has(id))

                if (allSelected) {
                    targetIds.forEach(id => next.delete(id))
                } else {
                    targetIds.forEach(id => next.add(id))
                }
                return next
            })
        }
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (selectedPositionIds.size === 0) return

        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) return

        const selectedZone = zones.find(z => z.id === hallId)
        const isSpecificHall = selectedZone && (selectedZone as any).is_hall

        const targetZoneIds = new Set<string>()

        if (isSpecificHall) {
            targetZoneIds.add(hallId)
            let added = true
            while (added) {
                added = false
                for (const z of zones) {
                    if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
                        targetZoneIds.add(z.id)
                        added = true
                    }
                }
            }
        } else {
            const hallsInWarehouse = zones.filter(z => {
                if (!(z as any).is_hall) return false
                let curr = z
                const seen = new Set()
                while (curr.parent_id && !seen.has(curr.id)) {
                    seen.add(curr.id)
                    if (curr.parent_id === hallId) return true
                    const parent = zones.find(p => p.id === curr.parent_id)
                    if (!parent) break
                    curr = parent
                }
                return false
            })

            hallsInWarehouse.forEach(h => {
                targetZoneIds.add(h.id)
            })

            let added = true
            while (added) {
                added = false
                for (const z of zones) {
                    if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
                        targetZoneIds.add(z.id)
                        added = true
                    }
                }
            }
        }

        if (targetZoneIds.size === 0) {
            showToast('Không tìm thấy sảnh nào trong khu vực đã chọn.', 'error')
            return
        }

        const rawAvailable = positions.filter(p => p.zone_id && targetZoneIds.has(p.zone_id) && !p.lot_id)
        const availablePositions = sortPositionsByBinPriority(rawAvailable as any[])

        if (availablePositions.length < lotIdsToMove.size) {
            showToast(`Không đủ vị trí trống trong Sảnh này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions.length} vị trí.`, 'error')
            return
        }

        const lotsArr = Array.from(lotIdsToMove)
        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)

        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        const assignUpdates: any[] = lotsArr.map((lotId, i) => ({ id: availablePositions[i].id, lot_id: lotId }))

        setPositions(prev => prev.map(p => {
            const clearUpd = clearUpdates.find(u => u.id === p.id)
            if (clearUpd) return { ...p, lot_id: null }
            const assignUpd = assignUpdates.find(u => u.id === p.id)
            if (assignUpd) return { ...p, lot_id: assignUpd.lot_id }
            return p
        }))

        try {
            await updatePositionsWithLog(clearUpdates)
            await updatePositionsWithLog(assignUpdates)

            showToast('Đã di chuyển hàng thành công!', 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Move to Hall error:', error)
            showToast('Lỗi khi di chuyển: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleMoveItems(targetPositionId: string) {
        setIsMoveModalOpen(false)
        if (selectedPositionIds.size === 0) return

        const targetPos = positions.find(p => p.id === targetPositionId)
        if (!targetPos) {
            showToast('Không tìm thấy vị trí đích đã chọn.', 'error')
            return
        }

        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) return
        const lotsArr = Array.from(lotIdsToMove)

        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)
        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        let assignUpdates: any[] = []

        if (lotsArr.length === 1) {
            assignUpdates = [{ id: targetPos.id, lot_id: lotsArr[0] }]
        } else {
            const targetZoneId = targetPos.zone_id
            const targetZoneIds = new Set<string>(targetZoneId ? [targetZoneId] : [])
            if (targetZoneId) {
                let added = true
                while (added) {
                    added = false
                    for (const z of zones) {
                        if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
                            targetZoneIds.add(z.id)
                            added = true
                        }
                    }
                }
            }

            const otherAvailable = positions.filter(p => p.id !== targetPos.id && p.zone_id && targetZoneIds.has(p.zone_id) && !p.lot_id)
            const sortedOther = sortPositionsByBinPriority(otherAvailable as any[])
            const candidatePositions = [targetPos, ...sortedOther]

            if (candidatePositions.length < lotsArr.length) {
                showToast(`Không đủ vị trí khả dụng trong khu vực. Cần ${lotsArr.length}, nhưng chỉ tìm thấy ${candidatePositions.length} vị trí.`, 'error')
                return
            }

            assignUpdates = lotsArr.map((lotId, i) => ({ id: candidatePositions[i].id, lot_id: lotId }))
        }

        setPositions(prev => prev.map(p => {
            const clearUpd = clearUpdates.find(u => u.id === p.id)
            if (clearUpd) return { ...p, lot_id: null }
            const assignUpd = assignUpdates.find(u => u.id === p.id)
            if (assignUpd) return { ...p, lot_id: assignUpd.lot_id }
            return p
        }))

        try {
            await updatePositionsWithLog(clearUpdates)
            await updatePositionsWithLog(assignUpdates)

            showToast(`Đã di chuyển sang vị trí ${targetPos.code} thành công!`, 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Move Items error:', error)
            showToast('Lỗi khi di chuyển: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleSwapLots(posAId: string, posBId: string) {
        const posA = positions.find(p => p.id === posAId)
        const posB = positions.find(p => p.id === posBId)
        if (!posA || !posB) return

        const lotAId = posA.lot_id
        const lotBId = posB.lot_id

        setPositions(prev => prev.map(p => {
            if (p.id === posAId) return { ...p, lot_id: lotBId }
            if (p.id === posBId) return { ...p, lot_id: lotAId }
            return p
        }))

        try {
            await updatePositionsWithLog([
                { id: posAId, lot_id: null },
                { id: posBId, lot_id: null }
            ])
            await updatePositionsWithLog([
                { id: posAId, lot_id: lotBId },
                { id: posBId, lot_id: lotAId }
            ])
            showToast('Đã hoán đổi vị trí thành công!', 'success')
            fetchData()
        } catch (error: any) {
            console.error('Swap lots error:', error)
            showToast('Lỗi khi hoán đổi vị trí: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleMoveLotToPosition(sourcePosId: string, targetPosId: string) {
        const sourcePos = positions.find(p => p.id === sourcePosId)
        const targetPos = positions.find(p => p.id === targetPosId)
        if (!sourcePos || !targetPos || !sourcePos.lot_id) return

        if (targetPos.lot_id) {
            await handleSwapLots(sourcePosId, targetPosId)
            return
        }

        const movingLotId = sourcePos.lot_id

        setPositions(prev => prev.map(p => {
            if (p.id === sourcePosId) return { ...p, lot_id: null }
            if (p.id === targetPosId) return { ...p, lot_id: movingLotId }
            return p
        }))

        try {
            await updatePositionsWithLog([{ id: sourcePosId, lot_id: null }])
            await updatePositionsWithLog([{ id: targetPosId, lot_id: movingLotId }])

            showToast(`Đã chuyển hàng sang vị trí ${targetPos.code || ''} thành công!`, 'success')
            fetchData()
        } catch (error: any) {
            console.error('Move lot error:', error)
            showToast('Lỗi khi chuyển vị trí: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleMoveLotToZoneShape(sourcePosId: string, targetShape: any) {
        const sourcePos = positions.find(p => p.id === sourcePosId)
        if (!sourcePos || !sourcePos.lot_id) return

        const isMultiLot = targetShape.isMultiLot !== false && targetShape.isStorage !== false
        const targetCodeUpper = (targetShape.code || '').trim().toUpperCase()
        const targetLabelUpper = (targetShape.label || '').trim().toUpperCase()

        const targetPositions = positions.filter(p => {
            const pCodeUpper = (p.code || '').trim().toUpperCase()
            if (targetCodeUpper) {
                if (pCodeUpper === targetCodeUpper || pCodeUpper.startsWith(targetCodeUpper + '-')) return true
                return false
            }
            if (targetLabelUpper) {
                if (pCodeUpper === targetLabelUpper || pCodeUpper.startsWith(targetLabelUpper + '-')) return true
            }
            if (targetShape.id && p.zone_id === targetShape.id) return true
            return false
        })

        const emptyPos = targetPositions.find(p => !p.lot_id)
        if (emptyPos) {
            await handleMoveLotToPosition(sourcePosId, emptyPos.id)
            return
        }

        if (!isMultiLot && targetPositions.length === 1 && targetPositions[0].id !== sourcePosId) {
            await handleSwapLots(sourcePosId, targetPositions[0].id)
            return
        }

        if (targetPositions.length === 0 || isMultiLot) {
            const movingLotId = sourcePos.lot_id
            try {
                const baseCode = targetCodeUpper || (targetShape.type ? `${targetShape.type}-${Date.now().toString().slice(-4)}` : `KV-${Date.now().toString().slice(-4)}`)
                let maxIdx = 0
                let hasExactBaseCode = false
                targetPositions.forEach(p => {
                    if (p.code === baseCode) hasExactBaseCode = true
                    const match = p.code?.match(/-(\d+)$/)
                    if (match) {
                        const num = parseInt(match[1], 10)
                        if (num > maxIdx) maxIdx = num
                    }
                })
                const nextIdx = Math.max(hasExactBaseCode ? 2 : 1, targetPositions.length + 1, maxIdx + 1)
                const newPosCode = isMultiLot ? `${baseCode}-${String(nextIdx).padStart(2, '0')}` : baseCode

                const { data: existingPos } = await (supabase.from('positions') as any)
                    .select('id, code, lot_id')
                    .eq('system_type', currentSystem?.code || systemType)
                    .eq('code', newPosCode)
                    .maybeSingle()

                if (existingPos) {
                    if (!existingPos.lot_id) {
                        await updatePositionsWithLog([{ id: sourcePosId, lot_id: null }])
                        await updatePositionsWithLog([{ id: existingPos.id, lot_id: movingLotId }])
                        showToast(`Đã chuyển hàng vào khu vực ${targetShape.label || targetShape.code} (${existingPos.code}) thành công!`, 'success')
                        fetchData()
                        return
                    }
                }

                const newPosId = crypto.randomUUID()

                const insertPayload = {
                    id: newPosId,
                    code: newPosCode,
                    lot_id: movingLotId,
                    system_type: currentSystem?.code || systemType,
                    company_id: profile?.company_id || (currentSystem as any)?.company_id || null
                }

                setPositions(prev => [
                    ...prev.map(p => p.id === sourcePosId ? { ...p, lot_id: null } : p),
                    {
                        ...insertPayload,
                        zone_id: targetShape.id
                    } as any
                ])

                await updatePositionsWithLog([{ id: sourcePosId, lot_id: null }])

                const { error: insErr } = await (supabase.from('positions') as any).insert(insertPayload)
                if (insErr) {
                    await updatePositionsWithLog([{ id: sourcePosId, lot_id: movingLotId }])
                    throw insErr
                }

                if (targetShape.id) {
                    const { data: zoneRow } = await (supabase.from('zones') as any).select('id').eq('id', targetShape.id).maybeSingle()
                    if ((zoneRow as any)?.id) {
                        await (supabase.from('zone_positions') as any).insert({
                            zone_id: targetShape.id,
                            position_id: newPosId
                        })
                    }

                    if (!targetShape.code) {
                        targetShape.code = baseCode
                        const { data: activeLayouts } = await (supabase.from('warehouse_layouts') as any)
                            .select('id, grid_data')
                            .eq('system_type', currentSystem?.code || systemType)
                            .eq('is_active', true)
                        if (activeLayouts && activeLayouts.length > 0) {
                            for (const l of activeLayouts) {
                                const shapes = l.grid_data || []
                                const matchIdx = shapes.findIndex((s: any) => s.id === targetShape.id)
                                if (matchIdx !== -1) {
                                    shapes[matchIdx].code = baseCode
                                    shapes[matchIdx].isStorage = true
                                    shapes[matchIdx].isMultiLot = true
                                    await (supabase.from('warehouse_layouts') as any).update({ grid_data: shapes }).eq('id', l.id)
                                }
                            }
                        }
                    }
                }

                showToast(`Đã chuyển hàng vào khu vực ${targetShape.label || targetShape.code} (${newPosCode}) thành công!`, 'success')
                fetchData()
            } catch (error: any) {
                console.error('Create and move lot error:', error)
                const msg = error?.message || error?.details || (typeof error === 'object' ? JSON.stringify(error) : String(error))
                showToast('Lỗi khi chuyển vào khu vực: ' + msg, 'error')
                fetchData()
            }
            return
        }

        showToast(`Khu vực "${targetShape.label || targetShape.code}" đã đầy, vui lòng kéo trực tiếp vào 1 ô cụ thể để hoán đổi.`, 'warning')
    }

    // --- Staging Queue Logic (Khu vực Chờ Nhập Kho cho Kho đang chọn) ---
    const [unassignedLots, setUnassignedLots] = useState<any[]>([])
    const [loadingUnassignedLots, setLoadingUnassignedLots] = useState(false)

    const fetchUnassignedLots = useCallback(async () => {
        const sysCode = currentSystem?.code || systemType
        if (!sysCode) return
        setLoadingUnassignedLots(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id, code, inbound_date, created_at, batch_code, warehouse_name, staging_area_code, metadata, status,
                    lot_items(id, quantity, unit, products(id, name, sku, unit)),
                    lot_tags(tag, lot_id, lot_item_id)
                `)
                .eq('system_code', sysCode)
                .neq('status', 'EXPORTED')
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error

            const occupiedLotIdSet = new Set(positions.filter(p => p.lot_id).map(p => p.lot_id))
            const unassigned = (data || []).filter((l: any) => !occupiedLotIdSet.has(l.id))

            const formatted = unassigned.map((l: any) => {
                const firstItem = l.lot_items?.[0]
                const totalQty = (l.lot_items || []).reduce((sum: number, it: any) => sum + (it.quantity || 0), 0)
                const tag = l.lot_tags?.[0]?.tag || l.metadata?.tag || ''
                const prodName = firstItem?.products?.name || l.metadata?.product_name || 'Lô hàng mới'
                const sku = firstItem?.products?.sku || ''
                const unit = firstItem?.unit || firstItem?.products?.unit || ''

                return {
                    lotId: l.id,
                    lotCode: l.code,
                    productName: prodName,
                    sku,
                    quantity: totalQty,
                    unit,
                    tag,
                    batchCode: l.batch_code,
                    warehouseName: l.warehouse_name,
                    stagingAreaCode: l.staging_area_code,
                    inboundDate: l.inbound_date || l.created_at,
                    systemType: sysCode
                }
            })

            setUnassignedLots(formatted)
        } catch (err) {
            console.error('Error fetching unassigned lots:', err)
        } finally {
            setLoadingUnassignedLots(false)
        }
    }, [currentSystem?.code, systemType, positions])

    useEffect(() => {
        fetchUnassignedLots()
    }, [fetchUnassignedLots])

    const handleAssignStagingLotToPosition = async (lotId: string, targetPosId: string) => {
        const targetPos = positions.find(p => p.id === targetPosId)
        if (!targetPos) return

        setPositions(prev => prev.map(p => p.id === targetPosId ? { ...p, lot_id: lotId } : p))
        setUnassignedLots(prev => prev.filter(l => l.lotId !== lotId))

        try {
            await updatePositionsWithLog([{ id: targetPosId, lot_id: lotId }])
            showToast(`Đã xếp lô hàng vào vị trí ${targetPos.code || ''} thành công!`, 'success')
            fetchData()
        } catch (err: any) {
            console.error('Assign staging lot error:', err)
            showToast('Lỗi khi xếp vị trí: ' + (err.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    const handleAssignStagingLotToZoneShape = async (lotId: string, targetShape: any) => {
        const targetCodeUpper = (targetShape.code || '').trim().toUpperCase()
        const targetLabelUpper = (targetShape.label || '').trim().toUpperCase()

        const targetPositions = positions.filter(p => {
            const pCodeUpper = (p.code || '').trim().toUpperCase()
            if (targetCodeUpper) {
                if (pCodeUpper === targetCodeUpper || pCodeUpper.startsWith(targetCodeUpper + '-')) return true
                return false
            }
            if (targetLabelUpper) {
                if (pCodeUpper === targetLabelUpper || pCodeUpper.startsWith(targetLabelUpper + '-')) return true
            }
            if (targetShape.id && p.zone_id === targetShape.id) return true
            return false
        })

        const emptyPos = targetPositions.find(p => !p.lot_id)
        if (emptyPos) {
            await handleAssignStagingLotToPosition(lotId, emptyPos.id)
            return
        }

        try {
            const baseCode = targetCodeUpper || (targetShape.type ? `${targetShape.type}-${Date.now().toString().slice(-4)}` : `KV-${Date.now().toString().slice(-4)}`)
            let maxIdx = 0
            let hasExactBaseCode = false
            targetPositions.forEach(p => {
                if (p.code === baseCode) hasExactBaseCode = true
                const match = p.code?.match(/-(\d+)$/)
                if (match) {
                    const num = parseInt(match[1], 10)
                    if (num > maxIdx) maxIdx = num
                }
            })
            const nextIdx = Math.max(hasExactBaseCode ? 2 : 1, targetPositions.length + 1, maxIdx + 1)
            const newCode = `${baseCode}-${String(nextIdx).padStart(2, '0')}`

            const { data: existingPos } = await (supabase.from('positions') as any)
                .select('id, code, lot_id')
                .eq('system_type', currentSystem?.code || systemType)
                .eq('code', newCode)
                .maybeSingle()

            if (existingPos && !existingPos.lot_id) {
                await handleAssignStagingLotToPosition(lotId, existingPos.id)
                return
            }

            const newPosId = crypto.randomUUID()

            const insertPayload = {
                id: newPosId,
                code: newCode,
                lot_id: lotId,
                system_type: currentSystem?.code || systemType,
                company_id: profile?.company_id || (currentSystem as any)?.company_id || null
            }

            const localPosObj = {
                ...insertPayload,
                zone_id: targetShape.id
            }

            setPositions(prev => [...prev, localPosObj as any])
            setUnassignedLots(prev => prev.filter(l => l.lotId !== lotId))

            const { error: insErr } = await (supabase.from('positions') as any).insert(insertPayload)
            if (insErr) throw insErr

            if (targetShape.id) {
                const { data: zoneRow } = await (supabase.from('zones') as any).select('id').eq('id', targetShape.id).maybeSingle()
                if ((zoneRow as any)?.id) {
                    await (supabase.from('zone_positions') as any).insert({
                        zone_id: targetShape.id,
                        position_id: newPosId
                    })
                }

                if (!targetShape.code) {
                    targetShape.code = baseCode
                    const { data: activeLayouts } = await (supabase.from('warehouse_layouts') as any)
                        .select('id, grid_data')
                        .eq('system_type', currentSystem?.code || systemType)
                        .eq('is_active', true)
                    if (activeLayouts && activeLayouts.length > 0) {
                        for (const l of activeLayouts) {
                            const shapes = l.grid_data || []
                            const matchIdx = shapes.findIndex((s: any) => s.id === targetShape.id)
                            if (matchIdx !== -1) {
                                shapes[matchIdx].code = baseCode
                                shapes[matchIdx].isStorage = true
                                shapes[matchIdx].isMultiLot = true
                                await (supabase.from('warehouse_layouts') as any).update({ grid_data: shapes }).eq('id', l.id)
                            }
                        }
                    }
                }
            }

            await logActivity({
                supabase,
                tableName: 'positions',
                recordId: newPosId,
                action: 'CREATE',
                newData: insertPayload,
                systemCode: currentSystem?.code || ''
            })

            showToast(`Đã xếp lô hàng vào khu vực ${targetShape.label || targetShape.code} (${newCode})!`, 'success')
            fetchData()
        } catch (err: any) {
            console.error('Auto create position for staging lot error:', err)
            showToast('Lỗi khi xếp vị trí vào khu vực: ' + (err.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleAutoAssignWarehouse(params: { warehouseId: string; hallId: string | null }) {
        setIsAutoAssignModalOpen(false)
        if (selectedPositionIds.size === 0) return

        const { warehouseId, hallId } = params

        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) {
            showToast('Không có LOT nào trong các ô được chọn.', 'warning')
            return
        }

        let targetHalls: any[] = []

        if (hallId) {
            const hall = zones.find(z => z.id === hallId && (z as any).is_hall)
            if (!hall) {
                showToast('Không tìm thấy Sảnh đã chọn.', 'error')
                return
            }
            targetHalls = [hall]
        } else {
            const allDescendants = new Set<string>([warehouseId])
            let added = true
            while (added) {
                added = false
                for (const z of zones) {
                    if (z.parent_id && allDescendants.has(z.parent_id) && !allDescendants.has(z.id)) {
                        allDescendants.add(z.id)
                        added = true
                    }
                }
            }

            targetHalls = zones
                .filter(z => allDescendants.has(z.id) && (z as any).is_hall)
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
        }

        if (targetHalls.length === 0) {
            showToast('Kho này chưa được cấu hình Sảnh.', 'error')
            return
        }

        let availablePositions: any[] = []
        for (const hall of targetHalls) {
            const hallZoneIds = new Set<string>([hall.id])
            let hAdded = true
            while (hAdded) {
                hAdded = false
                for (const z of zones) {
                    if (z.parent_id && hallZoneIds.has(z.parent_id) && !hallZoneIds.has(z.id)) {
                        hallZoneIds.add(z.id)
                        hAdded = true
                    }
                }
            }

            const rawHallPositions = positions.filter(p => p.zone_id && hallZoneIds.has(p.zone_id) && !p.lot_id)
            const sortedHallPositions = sortPositionsByBinPriority(rawHallPositions as any[])
            availablePositions = [...availablePositions, ...sortedHallPositions]

            if (availablePositions.length >= lotIdsToMove.size) break
        }

        if (availablePositions.length < lotIdsToMove.size) {
            showToast(`Không đủ vị trí trống trong Kho này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions.length} vị trí.`, 'error')
            return
        }

        const lotsArr = Array.from(lotIdsToMove)
        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)

        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        const assignUpdates: any[] = lotsArr.map((lotId, i) => ({ id: availablePositions[i].id, lot_id: lotId }))

        try {
            await updatePositionsWithLog(clearUpdates)
            await updatePositionsWithLog(assignUpdates)

            showToast(`Đã gán thành công ${lotsArr.length} LOT vào Kho mới!`, 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Auto Assign error:', error)
            showToast('Lỗi khi gán tự động: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    return {
        selectedPositions,
        selectedLotIds,
        updatePositionsWithLog,
        handlePositionSelect,
        handleMoveToHall,
        handleMoveItems,
        handleSwapLots,
        handleMoveLotToPosition,
        handleMoveLotToZoneShape,
        unassignedLots,
        loadingUnassignedLots,
        fetchUnassignedLots,
        handleAssignStagingLotToPosition,
        handleAssignStagingLotToZoneShape,
        handleAutoAssignWarehouse,
    }
}
