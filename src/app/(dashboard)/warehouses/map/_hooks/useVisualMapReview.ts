'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import {
    getWarehouseProposals,
    approveWarehouseProposal,
    approveSingleProposalItem,
    WarehouseProposal,
    ProposalItem,
} from '@/lib/warehouseAdjustmentService'

interface UseVisualMapReviewParams {
    systemType: string | null | undefined
    zones: any[]
    positions: any[]
    isGrouped: boolean
    profile: any
    setSearchTerm: (term: string) => void
    setSelectedZoneId: (zoneId: string | null) => void
    setCollapsedZones: React.Dispatch<React.SetStateAction<Set<string>>>
    fetchData: () => Promise<any> | void
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
}

export function useVisualMapReview({
    systemType,
    zones,
    positions,
    isGrouped,
    profile,
    setSearchTerm,
    setSelectedZoneId,
    setCollapsedZones,
    fetchData,
    showToast,
}: UseVisualMapReviewParams) {
    const [isProposalsModalOpen, setIsProposalsModalOpen] = useState(false)
    const [pendingProposalCount, setPendingProposalCount] = useState(0)

    const refreshProposalCount = useCallback(async () => {
        if (!systemType) return
        try {
            const list = await getWarehouseProposals(supabase, systemType, 'PENDING')
            setPendingProposalCount(list.length)
        } catch {
            // ignore
        }
    }, [systemType])

    useEffect(() => {
        refreshProposalCount()
        const interval = setInterval(refreshProposalCount, 30000)
        return () => clearInterval(interval)
    }, [refreshProposalCount])

    const handleFocusPosition = useCallback((positionId: string, positionCode?: string) => {
        if (positionCode) {
            setSearchTerm(positionCode)
        }
        const el = document.getElementById(`pos-${positionId}`) || document.getElementById(`position-${positionId}`)
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            el.classList.add('animate-pulse', 'ring-4', 'ring-amber-500')
            setTimeout(() => {
                el.classList.remove('animate-pulse', 'ring-4', 'ring-amber-500')
            }, 5000)
        }
    }, [setSearchTerm])

    // ── CHẾ ĐỘ DUYỆT TRỰC QUAN TRÊN BẢN ĐỒ (VISUAL MAP REVIEW MODE) ──
    const [visualReviewProposal, setVisualReviewProposal] = useState<WarehouseProposal | null>(null)
    const [visualReviewIndex, setVisualReviewIndex] = useState<number>(0)
    const [isProcessingVisualReview, setIsProcessingVisualReview] = useState<boolean>(false)

    // Map position_id -> ProposalItem để các ô trên bản đồ phát sáng (chỉ sáng các ô chưa duyệt)
    const visualReviewItemsMap = useMemo(() => {
        if (!visualReviewProposal || !visualReviewProposal.items) return new Map<string, ProposalItem>()
        const map = new Map<string, ProposalItem>()
        for (const it of visualReviewProposal.items) {
            if (it.status === 'APPROVED') continue
            if (it.position_id) {
                map.set(it.position_id, it)
            }
        }
        return map
    }, [visualReviewProposal])

    // Map target_position_id -> ProposalItem cho các ô đích của thao tác MOVE
    const visualReviewTargetMap = useMemo(() => {
        if (!visualReviewProposal || !visualReviewProposal.items) return new Map<string, ProposalItem>()
        const map = new Map<string, ProposalItem>()
        for (const it of visualReviewProposal.items) {
            if (it.status === 'APPROVED') continue
            if (it.action_type === 'MOVE' && it.target_position_id) {
                map.set(it.target_position_id, it)
            }
        }
        return map
    }, [visualReviewProposal])

    // Đếm số lượng đề xuất điều chỉnh cho từng Zone (từ Tầng -> Ô -> Dãy -> Kho)
    const zoneProposalCounts = useMemo(() => {
        const counts = new Map<string, number>()
        if (!visualReviewProposal || !visualReviewProposal.items || visualReviewProposal.items.length === 0) {
            return counts
        }

        const effectiveData = isGrouped ? groupWarehouseData(zones, positions) : { zones, positions }
        const effectiveZones = (effectiveData as any).zones || zones
        const effectivePositions = (effectiveData as any).positions || positions

        const zoneMap = new Map<string, any>()
        effectiveZones.forEach((z: any) => zoneMap.set(z.id, z))

        const posMap = new Map<string, any>()
        const posByCode = new Map<string, any>()
        effectivePositions.forEach((p: any) => {
            posMap.set(p.id, p)
            if (p.code) posByCode.set(p.code, p)
            if (Array.isArray(p.realIds)) {
                p.realIds.forEach((rid: string) => posMap.set(rid, p))
            }
        })

        const zoneSets = new Map<string, Set<string>>()
        const addToAncestors = (zoneId: string | null | undefined, itemKey: string) => {
            let curr = zoneId
            const visited = new Set<string>()
            while (curr && zoneMap.has(curr) && !visited.has(curr)) {
                visited.add(curr)
                if (!zoneSets.has(curr)) zoneSets.set(curr, new Set())
                zoneSets.get(curr)!.add(itemKey)
                curr = zoneMap.get(curr)?.parent_id
            }
        }

        visualReviewProposal.items.forEach((it, idx) => {
            if (it.status === 'APPROVED') return
            const itemKey = it.id || it.position_id || `idx-${idx}`
            const srcPos = posMap.get(it.position_id) || (it.position_code ? posByCode.get(it.position_code) : null)
            if (srcPos?.zone_id) {
                addToAncestors(srcPos.zone_id, itemKey)
            }
            if (it.action_type === 'MOVE' && (it.target_position_id || it.target_position_code)) {
                const dstPos = (it.target_position_id ? posMap.get(it.target_position_id) : null)
                    || (it.target_position_code ? posByCode.get(it.target_position_code) : null)
                if (dstPos?.zone_id) {
                    addToAncestors(dstPos.zone_id, itemKey)
                }
            }
        })

        zoneSets.forEach((set, zId) => counts.set(zId, set.size))
        return counts
    }, [visualReviewProposal, zones, positions, isGrouped])

    const handleExpandProposalZones = useCallback(() => {
        if (zoneProposalCounts.size === 0) return
        setCollapsedZones(prev => {
            const next = new Set(prev)
            zoneProposalCounts.forEach((count, zId) => {
                if (count > 0) next.delete(zId)
            })
            return next
        })
    }, [zoneProposalCounts, setCollapsedZones])

    const currentVisualItem = useMemo(() => {
        if (!visualReviewProposal || !visualReviewProposal.items) return null
        return visualReviewProposal.items[visualReviewIndex] || null
    }, [visualReviewProposal, visualReviewIndex])

    const currentVisualPositionId = currentVisualItem?.position_id || null

    const handleFocusPositionOnMap = useCallback((positionId: string, _positionCode?: string) => {
        const effectiveData = isGrouped ? groupWarehouseData(zones, positions) : { zones, positions }
        const effectiveZones = (effectiveData as any).zones || zones
        const effectivePositions = (effectiveData as any).positions || positions

        const zoneMap = new Map<string, any>()
        effectiveZones.forEach((z: any) => zoneMap.set(z.id, z))

        const targetPos = effectivePositions.find((p: any) =>
            p.id === positionId || (Array.isArray(p.realIds) && p.realIds.includes(positionId))
        )

        if (targetPos?.zone_id) {
            setCollapsedZones(prev => {
                const next = new Set(prev)
                let curr: string | null | undefined = targetPos.zone_id
                const visited = new Set<string>()
                while (curr && zoneMap.has(curr) && !visited.has(curr)) {
                    visited.add(curr)
                    next.delete(curr)
                    curr = zoneMap.get(curr)?.parent_id
                }
                return next
            })
        }

        setTimeout(() => {
            const el = document.getElementById(`pos-${positionId}`) || document.getElementById(`position-${positionId}`)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }, 180)
    }, [isGrouped, zones, positions, setCollapsedZones])

    const handleStartVisualReview = useCallback((proposal: WarehouseProposal, startIndex: number = 0) => {
        setVisualReviewProposal(proposal)
        const clamped = Math.max(0, Math.min(startIndex, proposal.items.length - 1))
        const firstPendingIdx = proposal.items[clamped]?.status === 'APPROVED'
            ? Math.max(0, proposal.items.findIndex(it => it.status !== 'APPROVED'))
            : clamped
        setVisualReviewIndex(firstPendingIdx)
        setIsProposalsModalOpen(false)
        setSearchTerm('')
        setSelectedZoneId(null)
        const effectiveData = isGrouped ? groupWarehouseData(zones, positions) : { zones, positions }
        const effectiveZones: any[] = (effectiveData as any).zones || zones
        setCollapsedZones(new Set(effectiveZones.filter(z => z.parent_id).map(z => z.id)))
        const pendingCount = proposal.items.filter(it => it.status !== 'APPROVED').length
        showToast(`Đã bật duyệt trên bản đồ (${pendingCount} vị trí chưa duyệt). Bấm vào các khu vực sáng màu vàng để đi tới vị trí cần duyệt.`, 'info')
    }, [isGrouped, zones, positions, setSearchTerm, setSelectedZoneId, setCollapsedZones, showToast])

    const handleSelectVisualReviewItem = useCallback((posId: string) => {
        if (!visualReviewProposal) return
        const idx = visualReviewProposal.items.findIndex(it => it.position_id === posId)
        if (idx >= 0) {
            setVisualReviewIndex(idx)
        }
    }, [visualReviewProposal])

    const handleApproveVisualItem = useCallback(async (item: ProposalItem) => {
        if (!visualReviewProposal || isProcessingVisualReview) return
        setIsProcessingVisualReview(true)
        try {
            const res = await approveSingleProposalItem(supabase, visualReviewProposal, item, {
                id: profile?.id,
                name: profile?.full_name || profile?.email || 'Quản lý'
            })

            if (res.success) {
                showToast(`✅ Đã duyệt và cập nhật vị trí ${item.position_code}!`, 'success')
                await fetchData()
                await refreshProposalCount()

                if (res.isProposalCompleted) {
                    showToast(`🎉 Toàn bộ các vị trí trong phiếu đã được duyệt hoàn tất!`, 'success')
                    setVisualReviewProposal(null)
                } else {
                    const updatedItems = visualReviewProposal.items.map(it =>
                        (it.id === item.id || it.position_id === item.position_id)
                            ? { ...it, status: 'APPROVED' as const }
                            : it
                    )
                    const nextPendingIdx = updatedItems.findIndex(it => it.status !== 'APPROVED')
                    setVisualReviewProposal({
                        ...visualReviewProposal,
                        items: updatedItems,
                        total_positions: updatedItems.length
                    })
                    if (nextPendingIdx >= 0) {
                        setVisualReviewIndex(nextPendingIdx)
                    }
                }
            } else {
                showToast(`❌ Lỗi duyệt ô: ${res.error}`, 'error')
            }
        } finally {
            setIsProcessingVisualReview(false)
        }
    }, [visualReviewProposal, isProcessingVisualReview, profile, showToast, fetchData, refreshProposalCount])

    const handleApproveAllVisualProposal = useCallback(async () => {
        if (!visualReviewProposal || isProcessingVisualReview) return
        if (!window.confirm(`Bạn có chắc chắn muốn duyệt toàn bộ ${visualReviewProposal.items.length} vị trí trong phiếu này?`)) {
            return
        }
        setIsProcessingVisualReview(true)
        try {
            const res = await approveWarehouseProposal(supabase, visualReviewProposal, {
                id: profile?.id,
                name: profile?.full_name || profile?.email || 'Quản lý'
            })

            if (res.success) {
                showToast(`🎉 Đã duyệt toàn bộ ${res.appliedCount || visualReviewProposal.items.length} vị trí vào sơ đồ kho!`, 'success')
                await fetchData()
                await refreshProposalCount()
                setVisualReviewProposal(null)
            } else {
                showToast(`❌ Lỗi khi duyệt: ${res.error}`, 'error')
            }
        } finally {
            setIsProcessingVisualReview(false)
        }
    }, [visualReviewProposal, isProcessingVisualReview, profile, showToast, fetchData, refreshProposalCount])

    return {
        isProposalsModalOpen,
        setIsProposalsModalOpen,
        pendingProposalCount,
        refreshProposalCount,
        handleFocusPosition,
        visualReviewProposal,
        setVisualReviewProposal,
        visualReviewIndex,
        setVisualReviewIndex,
        isProcessingVisualReview,
        visualReviewItemsMap,
        visualReviewTargetMap,
        zoneProposalCounts,
        handleExpandProposalZones,
        currentVisualPositionId,
        handleFocusPositionOnMap,
        handleStartVisualReview,
        handleSelectVisualReviewItem,
        handleApproveVisualItem,
        handleApproveAllVisualProposal,
    }
}
