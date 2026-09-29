'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    CheckCircle2, MapPin, Hash, PlayCircle, X, Loader2, Download, 
    RotateCcw, Send, Package, Trash2, ArrowRight, ExternalLink, 
    Smartphone, Search, ChevronRight, Layers, ArrowLeft,
    Check, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react'
import { groupWarehouseData, sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { Database } from '@/lib/database.types'
import { useMobile } from '@/contexts/MobileContext'
import { encodeSTT, decodeSTT, getNextSTT } from '@/lib/numberUtils'

interface LocalLot {
    id: string
    code: string
    daily_seq: number | null
    product_names: string[]
    inbound_date: string
}

interface LocalPosition {
    id: string
    code: string
    lot_id: string | null
    zone_ids: string[]
}

interface PendingAssignment {
    lotId?: string | null
    lotCode?: string | null
    productNames?: string[]
    positionId: string
    positionCode: string
    stt: string
    productionDate: string
    timestamp: number
}

type Zone = Database['public']['Tables']['zones']['Row']

export default function WarehouseAssignContent() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const { state, updateData, updateSelection, addAssignment, clearAssignments, removeAssignment } = useMobile()

    const [loading, setLoading] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [isSyncing, setIsSyncing] = useState(false)
    const [pendingInDbCount, setPendingInDbCount] = useState<number | null>(null)

    // Master Data from Context
    const { zones, localPositions, localLots, selection, assignments, lastDownloadTime } = state
    const { step, warehouseId: selectedWarehouseId, aisleId: selectedAisleId, slotId: selectedSlotId, tierId: selectedTierId, selectionStep } = selection

    // Grouped Data for "Gom ô"
    const [groupedZones, setGroupedZones] = useState<Zone[]>([])
    const [virtualToRealMap, setVirtualToRealMap] = useState<Map<string, string[]>>(new Map())

    // UI Helpers
    const [suggestedPos, setSuggestedPos] = useState<LocalPosition | null>(null)
    const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
    const [currentStt, setCurrentStt] = useState('')
    const [posSearchTerm, setPosSearchTerm] = useState('')
    const [showPosSuggestions, setShowPosSuggestions] = useState(false)
    const [selectedProductionDate, setSelectedProductionDate] = useState(() => new Date().toISOString().split('T')[0])
    const [lastAssignedNotice, setLastAssignedNotice] = useState<{ stt: string, positionCode: string } | null>(null)
    const [zoneSiblingPositions, setZoneSiblingPositions] = useState<any[]>([])
    const [siblingZoneId, setSiblingZoneId] = useState<string | null>(null)
    const [loadingSiblings, setLoadingSiblings] = useState(false)

    const sttInputRef = useRef<HTMLInputElement>(null)
    const suggestedPosRef = useRef(suggestedPos)
    suggestedPosRef.current = suggestedPos
    const assignmentsRef = useRef(assignments)
    assignmentsRef.current = assignments

    const resetPositionSelection = () => {
        setSuggestedPos(null)
        setPosSearchTerm('')
        setCurrentStt('')
        setZoneSiblingPositions([])
        setSiblingZoneId(null)
    }

    // Re-calculate grouped data when zones/positions in context change
    useEffect(() => {
        if (zones.length > 0) {
            const { zones: gZones, virtualToRealMap: vMap } = groupWarehouseData(zones, localPositions as any)
            setGroupedZones(gZones)
            if (vMap) setVirtualToRealMap(vMap)
        }
    }, [zones, localPositions])

    // Load count of pending assignments in DB to show badge
    const fetchPendingDbCount = async () => {
        if (!currentSystem?.code) return
        try {
            const { count, error } = await supabase
                .from('pending_assignments')
                .select('*', { count: 'exact', head: true })
                .eq('system_code', currentSystem.code)
                .eq('status', 'pending')
            if (!error && count !== null) {
                setPendingInDbCount(count)
            }
        } catch (e) {
            console.error('Error fetching pending db count:', e)
        }
    }

    useEffect(() => {
        fetchPendingDbCount()
    }, [currentSystem])

    // Auto-fetch warehouse data if context is empty
    useEffect(() => {
        if (currentSystem?.code && profile?.company_id && zones.length === 0 && localPositions.length === 0 && !isDownloading) {
            downloadData(true)
        }
    }, [currentSystem, profile])

    async function downloadData(isSilent = false) {
        if (!currentSystem?.code || !profile?.company_id) return
        setIsDownloading(true)
        try {
            const fetchAll = async (baseQuery: any) => {
                let all: any[] = []
                let from = 0
                const batchStep = 1000
                while (true) {
                    const { data, error } = await baseQuery.range(from, from + batchStep - 1)
                    if (error) throw error
                    if (!data || data.length === 0) break
                    all = [...all, ...data]
                    if (data.length < batchStep) break
                    from += batchStep
                }
                return all
            }

            // 1. Fetch ALL Position Status
            const posQuery = supabase.from('positions')
                .select('id, code, lot_id')
                .eq('system_type', currentSystem.code)

            const posData = await fetchAll(posQuery)
            const assignedLotIds = new Set(posData.map((p: any) => p.lot_id).filter(Boolean))

            // 2. Fetch Active Lots (Lobby Pool)
            const lotsQuery = supabase.from('lots')
                .select(`id, code, daily_seq, inbound_date, status, lot_items(products(name))`)
                .eq('system_code', currentSystem.code)
                .eq('status', 'active')

            const rawLots = await fetchAll(lotsQuery)
            const unassignedLots = rawLots.filter((l: any) => !assignedLotIds.has(l.id))

            const lotMap = new Map<string, { code: string, daily_seq: number | null }>()
            rawLots.forEach((l: any) => {
                lotMap.set(l.id, { code: l.code, daily_seq: l.daily_seq })
            })

            // Fetch pending assignments (status = 'pending')
            const { data: pendingData } = await (supabase.from('pending_assignments') as any)
                .select('position_id, lot_stt')
                .eq('system_code', currentSystem.code)
                .eq('status', 'pending')

            const pendingMap = new Map<string, string>()
            pendingData?.forEach((p: any) => {
                if (p.position_id) {
                    pendingMap.set(p.position_id, decodeSTT(p.lot_stt))
                }
            })

            const formattedLots: LocalLot[] = (unassignedLots || []).map((l: any) => ({
                id: l.id,
                code: l.code,
                daily_seq: l.daily_seq,
                inbound_date: l.inbound_date,
                product_names: l.lot_items?.map((li: any) => li.products?.name).filter(Boolean) || []
            }))

            // 3. Process Empty Positions & All Positions with STT
            const emptyPositions = posData.filter((p: any) => !p.lot_id)
            const zpQuery = supabase.from('zone_positions').select('position_id, zone_id')
            const zpData = await fetchAll(zpQuery)

            const zpMap = new Map<string, string[]>()
            zpData.forEach((item: any) => {
                const list = zpMap.get(item.position_id) || []
                list.push(item.zone_id)
                zpMap.set(item.position_id, list)
            })

            const formattedPositions: LocalPosition[] = (emptyPositions || []).map((p: any) => ({
                id: p.id,
                code: p.code,
                lot_id: p.lot_id,
                zone_ids: zpMap.get(p.id) || []
            }))

            const formattedAllPositions = (posData || []).map((p: any) => {
                let stt: string | null = null
                const lotInfo = p.lot_id ? lotMap.get(p.lot_id) : null
                if (lotInfo?.daily_seq) {
                    stt = decodeSTT(lotInfo.daily_seq)
                } else if (pendingMap.has(p.id)) {
                    stt = pendingMap.get(p.id) || null
                }
                return {
                    id: p.id,
                    code: p.code,
                    lot_id: p.lot_id,
                    stt,
                    lot_code: lotInfo?.code || null,
                    zone_ids: zpMap.get(p.id) || []
                }
            })

            const zonesQuery = (supabase.from('zones') as any).select('*').eq('system_type', currentSystem.code)
            const zonesData = await fetchAll(zonesQuery)

            const { positions: gPositions } = groupWarehouseData(zonesData || [], formattedPositions as any)

            updateData({
                localLots: formattedLots,
                localPositions: gPositions || formattedPositions,
                allPositions: formattedAllPositions,
                zones: zonesData || []
            })

            fetchPendingDbCount()

            if (!isSilent) {
                showToast(`Đã tải xong: ${formattedLots.length} món tại sảnh | ${formattedPositions.length} vị trí trống`, 'success')
            }
        } catch (e: any) {
            showToast('Lỗi tải dữ liệu: ' + e.message, 'error')
        } finally {
            setIsDownloading(false)
        }
    }

    const getDescendantZoneIds = (zoneId: string) => {
        const members = virtualToRealMap.get(zoneId) || [zoneId]
        const allRealIds = new Set<string>(members)
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && allRealIds.has(z.parent_id) && !allRealIds.has(z.id)) {
                    allRealIds.add(z.id)
                    added = true
                }
            }
        }
        return Array.from(allRealIds)
    }


    async function syncAssignments() {
        if (assignments.length === 0 || !currentSystem?.code) return
        setIsSyncing(true)
        try {
            const toSync = assignments.map((ass: any) => ({
                position_id: ass.positionId,
                lot_stt: encodeSTT(ass.stt),
                production_date: ass.productionDate,
                system_code: currentSystem.code,
                created_by: profile?.id,
                status: 'pending'
            }))
            const { error } = await (supabase.from('pending_assignments') as any).insert(toSync)
            if (error) throw error
            showToast(`Đồng bộ thành công ${assignments.length} mục lên hệ thống!`, 'success')
            clearAssignments()
            updateSelection({ step: 'setup' })
            fetchPendingDbCount()
        } catch (e: any) {
            showToast('Lỗi đồng bộ: ' + e.message, 'error')
        } finally {
            setIsSyncing(false)
        }
    }

    const activeZones: Zone[] = groupedZones.length > 0 ? groupedZones : zones
    const sortZones = (list: Zone[]) => [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
    const warehouses: Zone[] = sortZones(activeZones.filter(z => !z.parent_id))
    const aisles: Zone[] = selectedWarehouseId ? sortZones(activeZones.filter(z => z.parent_id === selectedWarehouseId)) : []
    const slots: Zone[] = selectedAisleId ? sortZones(activeZones.filter(z => z.parent_id === selectedAisleId)) : []
    const tiers: Zone[] = selectedSlotId ? sortZones(activeZones.filter(z => z.parent_id === selectedSlotId)) : []

    const emptyCounts = useMemo(() => {
        const counts = new Map<string, number>()
        if (localPositions.length === 0) return counts
        const assignedPosIds = new Set(assignments.map((a: any) => a.positionId))
        zones.forEach(z => counts.set(z.id, 0))
        const parentMap = new Map<string, string | null>()
        zones.forEach(z => parentMap.set(z.id, z.parent_id))

        localPositions.forEach((p: any) => {
            if (assignedPosIds.has(p.id)) return
            const processedInThisPath = new Set<string>()
            p.zone_ids.forEach((leafId: string) => {
                let currId: string | null = leafId
                while (currId) {
                    if (counts.has(currId) && !processedInThisPath.has(currId)) {
                        counts.set(currId, (counts.get(currId) || 0) + 1)
                        processedInThisPath.add(currId)
                    }
                    currId = parentMap.get(currId) || null
                }
            })
        })
        virtualToRealMap.forEach((realIds, vId) => {
            let total = 0
            realIds.forEach(rId => { total += counts.get(rId) || 0 })
            counts.set(vId, total)
        })
        return counts
    }, [zones, localPositions, assignments, virtualToRealMap])

    const getZoneName = (id: string | null) => activeZones.find(z => z.id === id)?.name || ''
    const effectiveZoneId = selectedTierId || selectedSlotId || selectedAisleId || selectedWarehouseId

    // Filter suggestions based on search term
    const posSuggestions = useMemo(() => {
        if (!posSearchTerm || !showPosSuggestions) return []
        const term = posSearchTerm.toUpperCase()
        const assignedPosIds = new Set(assignments.map((a: any) => a.positionId))
        return localPositions
            .filter(p => !assignedPosIds.has(p.id) && p.code.toUpperCase().includes(term))
            .slice(0, 8)
    }, [posSearchTerm, showPosSuggestions, localPositions, assignments])

    const breadcrumbs = [
        { label: 'Kho', id: selectedWarehouseId, setStep: () => { updateSelection({ selectionStep: 'warehouse', aisleId: null, slotId: null, tierId: null }); resetPositionSelection() } },
        { label: 'Dãy', id: selectedAisleId, setStep: () => { updateSelection({ selectionStep: 'aisle', slotId: null, tierId: null }); resetPositionSelection() } },
        { label: 'Ô', id: selectedSlotId, setStep: () => { updateSelection({ selectionStep: 'slot', tierId: null }); resetPositionSelection() } },
        { label: 'Tầng', id: selectedTierId, setStep: () => { updateSelection({ selectionStep: 'tier' }); resetPositionSelection() } }
    ].filter(b => b.id)

    const zoneBreadcrumbTitle = useMemo(() => {
        const parts = [
            getZoneName(selectedWarehouseId),
            getZoneName(selectedAisleId),
            getZoneName(selectedSlotId),
            getZoneName(selectedTierId)
        ].filter(Boolean)
        return parts.join(' > ')
    }, [selectedWarehouseId, selectedAisleId, selectedSlotId, selectedTierId, activeZones])

    // Reset position selection whenever effectiveZoneId changes to avoid leaking positions across zones
    const prevEffectiveZoneIdRef = useRef<string | null>(effectiveZoneId)
    useEffect(() => {
        if (prevEffectiveZoneIdRef.current && prevEffectiveZoneIdRef.current !== effectiveZoneId) {
            resetPositionSelection()
        }
        prevEffectiveZoneIdRef.current = effectiveZoneId
    }, [effectiveZoneId])

    // Load sibling positions in current zone with STTs
    useEffect(() => {
        if (step !== 'working' || !effectiveZoneId || !currentSystem?.code) return

        let isMounted = true
        const currentTargetZoneId = effectiveZoneId
        async function fetchSiblingPositions() {
            setLoadingSiblings(true)
            try {
                const descendantIds = getDescendantZoneIds(currentTargetZoneId)
                if (!descendantIds || descendantIds.length === 0) {
                    if (isMounted) setLoadingSiblings(false)
                    return
                }

                // 1. Fetch zone_positions for this zone
                const { data: zpList, error: zpErr } = await (supabase.from('zone_positions') as any)
                    .select('position_id, zone_id')
                    .in('zone_id', descendantIds)

                if (zpErr || !zpList || zpList.length === 0) {
                    if (isMounted) setLoadingSiblings(false)
                    return
                }

                const posIds = Array.from(new Set((zpList as any[]).map((item: any) => item.position_id)))

                // 2. Fetch positions
                const { data: pList, error: pErr } = await (supabase.from('positions') as any)
                    .select('id, code, lot_id')
                    .in('id', posIds)

                if (pErr || !pList) {
                    if (isMounted) setLoadingSiblings(false)
                    return
                }

                // 3. Fetch lots for occupied positions
                const occupiedLotIds = pList.map((p: any) => p.lot_id).filter(Boolean)
                const lotMap = new Map<string, any>()
                if (occupiedLotIds.length > 0) {
                    const { data: lots } = await (supabase.from('lots') as any)
                        .select('id, code, daily_seq')
                        .in('id', occupiedLotIds)
                    lots?.forEach((l: any) => lotMap.set(l.id, l))
                }

                // 4. Fetch pending assignments
                const { data: pendings } = await (supabase.from('pending_assignments') as any)
                    .select('position_id, lot_stt')
                    .in('position_id', posIds)
                    .eq('status', 'pending')

                const pendMap = new Map<string, string>()
                pendings?.forEach((pa: any) => {
                    if (pa.position_id) pendMap.set(pa.position_id, decodeSTT(pa.lot_stt))
                })

                if (isMounted) {
                    const formatted = pList.map((p: any) => {
                        const lot = p.lot_id ? lotMap.get(p.lot_id) : null
                        let stt: string | null = null
                        if (lot?.daily_seq) {
                            stt = decodeSTT(lot.daily_seq)
                        } else if (pendMap.has(p.id)) {
                            stt = pendMap.get(p.id) || null
                        }
                        return {
                            id: p.id,
                            code: p.code,
                            lot_id: p.lot_id,
                            stt,
                            lot_code: lot?.code || null
                        }
                    }).sort((a: any, b: any) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))

                    setZoneSiblingPositions(formatted)
                    setSiblingZoneId(currentTargetZoneId)

                    // Ensure suggestedPos belongs to this zone
                    const currentSuggested = suggestedPosRef.current
                    const isCurrentValid = currentSuggested && formatted.some((p: any) => p.id === currentSuggested.id)
                    if (!isCurrentValid && formatted.length > 0) {
                        const assignedIds = new Set(assignmentsRef.current.map((a: any) => a.positionId))
                        const sorted = sortPositionsByBinPriority(formatted)
                        const firstEmpty = sorted.find((p: any) => !assignedIds.has(p.id) && !p.lot_id && !p.stt) || sorted[0]
                        if (firstEmpty) {
                            selectPosition(firstEmpty)
                        }
                    }
                }
            } catch (err) {
                console.error('Error fetching sibling positions:', err)
            } finally {
                if (isMounted) setLoadingSiblings(false)
            }
        }

        fetchSiblingPositions()
        return () => { isMounted = false }
    }, [step, effectiveZoneId, currentSystem?.code])

    const displaySiblingPositions = useMemo(() => {
        if (!effectiveZoneId) return []
        
        let baseList: any[] = []
        if (zoneSiblingPositions.length > 0 && siblingZoneId === effectiveZoneId) {
            baseList = zoneSiblingPositions
        } else if (state.allPositions && state.allPositions.length > 0) {
            const descendantIds = getDescendantZoneIds(effectiveZoneId)
            baseList = state.allPositions.filter((p: any) => 
                p.zone_ids && p.zone_ids.some((zId: string) => descendantIds.includes(zId))
            )
        } else if (localPositions && localPositions.length > 0) {
            const descendantIds = getDescendantZoneIds(effectiveZoneId)
            baseList = localPositions.filter((p: any) => 
                p.zone_ids && p.zone_ids.some((zId: string) => descendantIds.includes(zId))
            )
        }

        const localAssMap = new Map<string, string>()
        assignments.forEach((a: any) => {
            if (a.positionId) localAssMap.set(a.positionId, a.stt)
        })

        return baseList.map((p: any) => {
            const localStt = localAssMap.get(p.id)
            const isLocal = !!localStt
            const finalStt = localStt || p.stt
            const isTarget = suggestedPos?.id === p.id
            return {
                ...p,
                stt: finalStt,
                isLocal,
                isTarget,
                isAssigned: !!finalStt || !!p.lot_id
            }
        }).sort((a: any, b: any) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
    }, [zoneSiblingPositions, siblingZoneId, state.allPositions, localPositions, effectiveZoneId, assignments, suggestedPos, virtualToRealMap, zones])

    // Matrix parser for visual warehouse card (matching physical paper sheet)
    const sheetData = useMemo(() => {
        if (!displaySiblingPositions || displaySiblingPositions.length === 0) return null

        function parsePosCode(code?: string | null) {
            if (!code) return { warehouse: '', row: '', bay: 'A', bin: '', tier: '', subPos: '1' }
            const match = code.match(/^K(\d+)D(\d+)([A-Z]+)(\d+)T(\d+)$/i)
            if (match) {
                const [_, k, d, bay, bin, t] = match
                const tier = t.charAt(0)
                const subPos = parseInt(t.slice(1), 10) || t.slice(1)
                return { warehouse: k, row: d, bay: bay.toUpperCase(), bin: bin, tier: tier, subPos: String(subPos) }
            }
            const match2 = code.match(/([A-Z]+)(\d+).*?T(\d+)/i)
            if (match2) {
                const [_, bay, bin, t] = match2
                const tier = t.charAt(0)
                const subPos = parseInt(t.slice(1), 10) || t.slice(1)
                return { warehouse: '', row: '', bay: bay.toUpperCase(), bin: bin, tier: tier, subPos: String(subPos) }
            }
            const bayM = code.match(/[A-Za-z]/)
            const subM = code.match(/(\d+)[^\d]*$/)
            return {
                warehouse: '',
                row: '',
                bay: bayM ? bayM[0].toUpperCase() : 'A',
                bin: '',
                tier: '',
                subPos: subM ? String(parseInt(subM[1], 10)) : '1'
            }
        }

        const parsed = displaySiblingPositions.map(p => ({
            ...p,
            details: parsePosCode(p.code)
        }))

        // Prioritize the slot & tier of suggestedPos if available, so changing positions switches the visible sheet!
        const targetDetails = parsed.find(p => p.id === suggestedPos?.id)?.details || parsed[0]?.details
        const warehouseRaw = getZoneName(selectedWarehouseId)
        const aisleRaw = getZoneName(selectedAisleId)
        const slotRaw = getZoneName(selectedSlotId)
        const tierRaw = getZoneName(selectedTierId)

        const warehouseVal = targetDetails?.warehouse || warehouseRaw.replace(/\D+/g, '') || warehouseRaw
        const aisleVal = targetDetails?.row || aisleRaw.replace(/\D+/g, '') || aisleRaw
        const slotVal = targetDetails?.bin || slotRaw.replace(/\D+/g, '') || slotRaw
        const tierVal = targetDetails?.tier || tierRaw.replace(/\D+/g, '') || tierRaw

        // Filter parsed to only the items in this current unit/sheet (matching slot & tier)
        const sheetItems = parsed.filter(p => {
            if (slotVal && p.details.bin && p.details.bin !== slotVal) return false
            if (tierVal && p.details.tier && p.details.tier !== tierVal) return false
            return true
        })
        const itemsToUse = sheetItems.length > 0 ? sheetItems : parsed

        const allBays = Array.from(new Set(itemsToUse.map(p => p.details.bay).filter(Boolean))).sort()
        const allSubs = Array.from(new Set(itemsToUse.map(p => p.details.subPos).filter(Boolean)))
            .sort((a, b) => Number(b) - Number(a)) // Descending: 2 on top, 1 on bottom

        return {
            bays: allBays.length > 0 ? allBays : ['A'],
            subPositions: allSubs.length > 0 ? allSubs : ['1'],
            warehouseVal,
            aisleVal,
            slotVal,
            tierVal,
            items: itemsToUse
        }
    }, [displaySiblingPositions, suggestedPos, selectedWarehouseId, selectedAisleId, selectedSlotId, selectedTierId, activeZones])

    const zoneParts = useMemo(() => {
        function formatZonePart(rawName: string, prefix: string) {
            if (!rawName) return ''
            const trimmed = rawName.trim().toUpperCase()
            if (trimmed.startsWith(prefix)) return trimmed
            return `${prefix} ${trimmed}`
        }

        let w = ''
        let a = ''
        let s = ''
        let t = ''

        if (sheetData?.warehouseVal && sheetData?.aisleVal && sheetData?.slotVal && sheetData?.tierVal) {
            w = formatZonePart(sheetData.warehouseVal, 'KHO')
            a = formatZonePart(sheetData.aisleVal, 'DÃY')
            s = formatZonePart(sheetData.slotVal, 'Ô')
            t = formatZonePart(sheetData.tierVal, 'TẦNG')
        } else if (suggestedPos?.code) {
            const match = suggestedPos.code.match(/^K(\d+)D(\d+)([A-Z]+)(\d+)T(\d+)$/i)
            if (match) {
                const [_, k, d, , bin, tRaw] = match
                w = `KHO ${k}`
                a = `DÃY ${d}`
                s = `Ô ${bin}`
                t = `TẦNG ${tRaw.charAt(0)}`
            }
        }

        if (!w && selectedWarehouseId) w = formatZonePart(getZoneName(selectedWarehouseId), 'KHO')
        if (!a && selectedAisleId) a = formatZonePart(getZoneName(selectedAisleId), 'DÃY')
        if (!s && selectedSlotId) s = formatZonePart(getZoneName(selectedSlotId), 'Ô')
        if (!t && selectedTierId) t = formatZonePart(getZoneName(selectedTierId), 'TẦNG')

        return {
            warehouse: w || 'KHO 1',
            aisle: a || 'DÃY 1',
            slot: s || '',
            tier: t || ''
        }
    }, [sheetData, suggestedPos, selectedWarehouseId, selectedAisleId, selectedSlotId, selectedTierId, activeZones])

    const handleNavigateToZone = (level: 'warehouse' | 'aisle' | 'slot' | 'tier') => {
        let wId = selectedWarehouseId
        let aId = selectedAisleId
        let sId = selectedSlotId

        // Try to resolve IDs from activeZones if missing
        if (!wId && sheetData?.warehouseVal) {
            const found = warehouses.find(w => w.name.includes(sheetData.warehouseVal))
            if (found) wId = found.id
        }
        if (wId && !aId && sheetData?.aisleVal) {
            const found = activeZones.find(z => z.parent_id === wId && z.name.includes(sheetData.aisleVal))
            if (found) aId = found.id
        }
        if (aId && !sId && sheetData?.slotVal) {
            const found = activeZones.find(z => z.parent_id === aId && z.name.includes(sheetData.slotVal))
            if (found) sId = found.id
        }

        resetPositionSelection()

        if (level === 'warehouse') {
            updateSelection({
                step: 'setup',
                selectionStep: 'aisle',
                warehouseId: wId,
                aisleId: null,
                slotId: null,
                tierId: null
            })
        } else if (level === 'aisle') {
            updateSelection({
                step: 'setup',
                selectionStep: 'slot',
                warehouseId: wId,
                aisleId: aId,
                slotId: null,
                tierId: null
            })
        } else if (level === 'slot' || level === 'tier') {
            updateSelection({
                step: 'setup',
                selectionStep: 'tier',
                warehouseId: wId,
                aisleId: aId,
                slotId: sId,
                tierId: null
            })
        }
    }

    // Ordered list of positions for navigation (row by row: 2A -> 2B -> 2C -> 1A -> 1B -> 1C)
    const navigationPositions = useMemo(() => {
        let list: any[] = []
        if (sheetData?.items && sheetData.items.length > 0) {
            const subOrder = sheetData.subPositions
            const bayOrder = sheetData.bays
            list = [...sheetData.items].sort((a: any, b: any) => {
                const sA = subOrder.indexOf(a.details.subPos)
                const sB = subOrder.indexOf(b.details.subPos)
                if (sA !== sB) return sA - sB
                const bA = bayOrder.indexOf(a.details.bay)
                const bB = bayOrder.indexOf(b.details.bay)
                if (bA !== bB) return bA - bB
                return (a.code || '').localeCompare(b.code || '')
            })
        } else if (displaySiblingPositions && displaySiblingPositions.length > 0) {
            list = sortPositionsByBinPriority(displaySiblingPositions)
        } else if (effectiveZoneId) {
            const descendantIds = getDescendantZoneIds(effectiveZoneId)
            const source = (state.allPositions && state.allPositions.length > 0) ? state.allPositions : localPositions
            const filtered = source.filter((p: any) =>
                p.zone_ids && p.zone_ids.some((zId: string) => descendantIds.includes(zId))
            )
            list = sortPositionsByBinPriority(filtered)
        }
        return list
    }, [sheetData, displaySiblingPositions, effectiveZoneId, state.allPositions, localPositions, virtualToRealMap, zones])

    // Get current STT for a given position ID from session assignments or existing data
    const getPositionStt = (posId: string): string => {
        const localAss = assignments.find((a: any) => a.positionId === posId)
        if (localAss?.stt) return localAss.stt

        const sib = displaySiblingPositions.find((p: any) => p.id === posId)
        if (sib?.stt) return sib.stt

        const allP = state.allPositions?.find((p: any) => p.id === posId)
        if (allP?.stt) return allP.stt

        return ''
    }

    // Select a position and automatically populate/select STT input for instant editing
    const selectPosition = (pos: any) => {
        if (!pos) return
        setSuggestedPos(pos)
        setPosSearchTerm(pos.code || '')
        const existingStt = getPositionStt(pos.id)
        setCurrentStt(existingStt)
        setShowPosSuggestions(false)
        setTimeout(() => {
            if (sttInputRef.current) {
                sttInputRef.current.focus()
                if (existingStt) {
                    sttInputRef.current.select()
                }
            }
        }, 50)
    }

    // Find the next empty position in navigation sequence
    const findNextEmptyPosition = (fromPosId?: string) => {
        if (!navigationPositions || navigationPositions.length === 0) return null
        const assignedIds = new Set(assignments.map(a => a.positionId))
        
        const isEmpty = (p: any) => {
            if (assignedIds.has(p.id)) return false
            if (p.lot_id) return false
            if (p.stt) return false
            return true
        }

        const currentIndex = navigationPositions.findIndex((p: any) => p.id === fromPosId)
        const n = navigationPositions.length

        for (let i = 1; i <= n; i++) {
            const checkIndex = (currentIndex + i) % n
            const candidate = navigationPositions[checkIndex]
            if (candidate && isEmpty(candidate)) {
                return candidate
            }
        }
        return null
    }

    // Move backward to previous position in sequence (looping around)
    const handlePrevPosition = () => {
        if (!navigationPositions || navigationPositions.length === 0) return
        const currentIndex = navigationPositions.findIndex((p: any) => p.id === suggestedPos?.id)
        let prevIndex: number
        if (currentIndex <= 0) {
            prevIndex = navigationPositions.length - 1
        } else {
            prevIndex = currentIndex - 1
        }
        const targetPos = navigationPositions[prevIndex]
        if (targetPos) {
            selectPosition(targetPos)
        }
    }

    // Move forward to next position in sequence (looping around)
    const handleNextPosition = () => {
        if (!navigationPositions || navigationPositions.length === 0) return
        const currentIndex = navigationPositions.findIndex((p: any) => p.id === suggestedPos?.id)
        let nextIndex: number
        if (currentIndex === -1 || currentIndex >= navigationPositions.length - 1) {
            nextIndex = 0
        } else {
            nextIndex = currentIndex + 1
        }
        const targetPos = navigationPositions[nextIndex]
        if (targetPos) {
            selectPosition(targetPos)
        }
    }

    const handleSkip = () => {
        handleNextPosition()
    }

    // Start assigning or suggest first empty position
    function suggestNextPosition() {
        if (!effectiveZoneId) return
        setLoading(true)
        try {
            const isCurrentPosInNav = suggestedPos && navigationPositions.some(p => p.id === suggestedPos.id)
            const firstEmpty = findNextEmptyPosition(isCurrentPosInNav ? suggestedPos?.id : undefined)
            if (firstEmpty) {
                selectPosition(firstEmpty)
                updateSelection({ step: 'working' })
            } else if (navigationPositions.length > 0) {
                selectPosition(navigationPositions[0])
                updateSelection({ step: 'working' })
            } else {
                const descendantIds = getDescendantZoneIds(effectiveZoneId)
                const source = (state.allPositions && state.allPositions.length > 0) ? state.allPositions : localPositions
                const candidates = source.filter((p: any) => p.zone_ids && p.zone_ids.some((zId: string) => descendantIds.includes(zId)))
                const sorted = sortPositionsByBinPriority(candidates)
                const assignedIds = new Set(assignments.map((a: any) => a.positionId))
                const emptyCandidate = sorted.find((p: any) => !assignedIds.has(p.id) && !p.lot_id && !p.stt) || sorted[0]
                if (emptyCandidate) {
                    selectPosition(emptyCandidate)
                    updateSelection({ step: 'working' })
                } else {
                    showToast('Không còn vị trí trống trong khu vực này!', 'error')
                    updateSelection({ step: 'setup' })
                }
            }
        } finally {
            setLoading(false)
        }
    }

    // Confirm or update assignment for currently selected position
    async function handleConfirmStt() {
        if (!suggestedPos || !currentStt.trim()) return
        const sttVal = currentStt.trim().toUpperCase()
        setLoading(true)
        try {
            const isEditingExisting = assignments.some((a: any) => a.positionId === suggestedPos.id)
            const newAssignment: PendingAssignment = {
                lotId: suggestedPos.lot_id || null, // Gán STT cho lot hiện có hoặc gán mù
                lotCode: suggestedPos.lot_code || `STT #${sttVal} (Gán mù)`,
                productNames: ['Hàng chờ khớp'],
                positionId: suggestedPos.id,
                positionCode: suggestedPos.code,
                stt: sttVal,
                productionDate: selectedProductionDate || new Date().toISOString().split('T')[0],
                timestamp: Date.now()
            }

            addAssignment(newAssignment)
            setLastAssignedNotice({ stt: sttVal, positionCode: suggestedPos.code })
            showToast(
                isEditingExisting 
                    ? `Đã cập nhật: #${sttVal} → ${suggestedPos.code}` 
                    : `Đã gán: #${sttVal} → ${suggestedPos.code}`, 
                'success'
            )

            const currentPositionId = suggestedPos.id

            // Tự động tìm ô trống tiếp theo trong khu vực để tiếp tục nhập nhanh
            const nextEmpty = findNextEmptyPosition(currentPositionId)
            if (nextEmpty) {
                selectPosition(nextEmpty)
            } else {
                showToast('Đã gán xong tất cả vị trí trong khu vực này!', 'success')
            }
        } catch (e: any) {
            showToast('Lỗi khi lưu: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    // Remove staged assignment for currently selected position
    const handleRemoveCurrentAssignment = () => {
        if (!suggestedPos) return
        removeAssignment(suggestedPos.id)
        setCurrentStt('')
        showToast(`Đã hủy gán ô ${suggestedPos.code}`, 'info')
        if (sttInputRef.current) {
            sttInputRef.current.focus()
        }
    }

    const isCurrentPosAssignedThisSession = assignments.some((a: any) => a.positionId === suggestedPos?.id)

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (step !== 'working') return

            // Shift + Enter: Đưa con trỏ quay lại ô nhập STT từ bất kỳ đâu
            if (e.key === 'Enter' && e.shiftKey) {
                e.preventDefault()
                if (sttInputRef.current) {
                    sttInputRef.current.focus()
                    sttInputRef.current.select()
                }
                return
            }

            const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

            // Phím mũi tên Trái / Phải để đổi vị trí:
            // 1. Khi không focus ô nhập: bấm ← hoặc → để lùi / tiến ô
            // 2. Khi đang focus ô nhập: bấm Alt + ← hoặc Alt + → để lùi / tiến ô
            if (e.key === 'ArrowLeft') {
                if (!isInputFocused || e.altKey) {
                    e.preventDefault()
                    handlePrevPosition()
                }
            } else if (e.key === 'ArrowRight') {
                if (!isInputFocused || e.altKey) {
                    e.preventDefault()
                    handleNextPosition()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [step, suggestedPos, navigationPositions, assignments])

    return (
        <div className="space-y-6 pb-24 max-w-7xl mx-auto">
            {/* Sleek, Compact Header Bar */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Left: Title + System Badge + Metric Stats */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                            <MapPin size={18} />
                        </div>
                        <h1 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                            Gán Vị Trí
                        </h1>
                        {currentSystem && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider">
                                {currentSystem.name}
                            </span>
                        )}
                    </div>

                    {/* Inline Stats & Status */}
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <Package size={13} className="text-zinc-400" />
                            <span>Sảnh: <strong className="text-zinc-800 dark:text-zinc-200 font-mono font-bold">{localLots.length}</strong> món</span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700">•</span>
                        <span className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Kệ: <strong className="text-emerald-700 dark:text-emerald-300 font-mono font-bold">{Math.max(0, localPositions.length - assignments.length).toLocaleString('vi-VN')}</strong> trống</span>
                        </span>
                        {assignments.length > 0 && (
                            <>
                                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50 flex items-center gap-1 animate-pulse">
                                    <Sparkles size={11} className="text-amber-500" />
                                    <span>Chờ đồng bộ: <strong className="font-mono">{assignments.length}</strong></span>
                                </span>
                            </>
                        )}
                        {lastDownloadTime && (
                            <>
                                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                <span className="text-[11px] text-zinc-400">
                                    Cập nhật: {new Date(lastDownloadTime).toLocaleTimeString('vi-VN')}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Right: Single-Row Aligned Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                        onClick={() => downloadData()}
                        disabled={isDownloading}
                        title="Tải lại dữ liệu sảnh & vị trí trống"
                        className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
                    >
                        <RefreshCw size={13} className={isDownloading ? 'animate-spin text-blue-600' : ''} />
                        <span>{isDownloading ? 'Đang tải...' : 'Tải lại'}</span>
                    </button>

                    {assignments.length > 0 && (
                        <button
                            onClick={() => {
                                if (confirm('⚠️ Bạn có chắc muốn xóa sạch toàn bộ danh sách gán tạm thời chưa đồng bộ?')) {
                                    clearAssignments()
                                    updateSelection({ step: 'setup' })
                                }
                            }}
                            title="Xóa danh sách tạm chưa đồng bộ"
                            className="p-2 bg-zinc-100 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-950/30 text-zinc-400 hover:text-red-600 rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                            <RotateCcw size={14} />
                        </button>
                    )}

                    <Link
                        href="/mobile/assign"
                        target="_blank"
                        title="Mở giao diện tối ưu cho thiết bị di động"
                        className="px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                        <Smartphone size={13} className="text-zinc-500" />
                        <span>Mobile</span>
                        <ExternalLink size={11} className="opacity-50" />
                    </Link>

                    <Link
                        href="/production-lot/assignments"
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-95"
                    >
                        <CheckCircle2 size={14} />
                        <span>Duyệt Gán Vị Trí</span>
                        {pendingInDbCount !== null && pendingInDbCount > 0 && (
                            <span className="px-1.5 py-0.2 bg-white text-blue-700 rounded-full text-[10px] font-black">
                                {pendingInDbCount}
                            </span>
                        )}
                    </Link>
                </div>
            </div>

            {/* Main Interactive Workflow */}
            <div className="space-y-6">
                
                {/* Main Workspace Column */}
                <div className="w-full space-y-6">
                    
                    {step === 'setup' ? (
                        /* STEP 1: ZONE SELECTION & SETUP */
                        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                            
                            {/* Header Guide */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                                <div>
                                    <h2 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                        <Layers className="text-emerald-600" size={20} />
                                        1. Chọn khu vực cần gán vị trí
                                    </h2>
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        Hệ thống sẽ tự động tìm các vị trí còn trống và gợi ý theo thứ tự ưu tiên tối ưu.
                                    </p>
                                </div>

                                {/* Production Date Picker */}
                                <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                                    <span className="text-[11px] font-bold text-zinc-500 uppercase">Ngày SX:</span>
                                    <input 
                                        type="date"
                                        value={selectedProductionDate}
                                        onChange={(e) => setSelectedProductionDate(e.target.value)}
                                        className="bg-transparent text-xs font-bold text-zinc-900 dark:text-white outline-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Breadcrumbs for Selection Hierarchy */}
                            {breadcrumbs.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider ml-1">Đang chọn:</span>
                                    {breadcrumbs.map((b, i) => (
                                        <React.Fragment key={i}>
                                            <button 
                                                onClick={b.setStep} 
                                                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm hover:border-emerald-400 transition-all flex items-center gap-1.5"
                                            >
                                                <span className="text-[10px] text-zinc-400 uppercase font-semibold">{b.label}:</span>
                                                <span>{getZoneName(b.id)}</span>
                                            </button>
                                            {i < breadcrumbs.length - 1 && <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />}
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            {/* Level 1: Warehouse */}
                            {selectionStep === 'warehouse' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                            <span>Bước 1: Chọn Kho hàng</span>
                                        </label>
                                        <span className="text-xs text-zinc-400 font-medium">Chọn một kho để bắt đầu</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {warehouses.filter(w => (emptyCounts.get(w.id) || 0) > 0).map(w => {
                                            const emptyCount = emptyCounts.get(w.id) || 0
                                            const isSelected = selectedWarehouseId === w.id
                                            return (
                                                <button
                                                    key={w.id}
                                                    onClick={() => updateSelection({ warehouseId: w.id, selectionStep: 'aisle' })}
                                                    className={`p-5 rounded-2xl border-2 text-left transition-all relative group flex flex-col justify-between min-h-[110px] ${
                                                        isSelected
                                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                                                            : 'bg-white dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 dark:hover:border-emerald-500'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className={`text-base font-black uppercase ${isSelected ? 'text-white' : 'text-zinc-900 dark:text-white'}`}>
                                                            {w.name}
                                                        </div>
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900'
                                                        }`}>
                                                            Trống {emptyCount}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3 text-xs opacity-75">
                                                        <span>Chọn để xem các dãy &rarr;</span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {warehouses.length === 0 && (
                                        <div className="text-center py-12 text-zinc-400 text-sm">
                                            Chưa có dữ liệu kho. Vui lòng bấm "Tải lại dữ liệu" ở phía trên.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Level 2: Aisle */}
                            {selectionStep === 'aisle' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                            Bước 2: Chọn Dãy ({getZoneName(selectedWarehouseId)})
                                        </label>
                                        <button 
                                            onClick={() => updateSelection({ selectionStep: 'warehouse' })} 
                                            className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                                        >
                                            <ArrowLeft size={14} /> Đổi Kho
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {aisles.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => {
                                            const emptyCount = emptyCounts.get(z.id) || 0
                                            const isSelected = selectedAisleId === z.id
                                            return (
                                                <button
                                                    key={z.id}
                                                    onClick={() => updateSelection({ aisleId: z.id, selectionStep: 'slot' })}
                                                    className={`p-5 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${
                                                        isSelected
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                                                            : 'bg-white dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="font-black text-sm uppercase text-zinc-900 dark:text-white">{z.name}</div>
                                                        <div className="text-[11px] text-zinc-400 mt-0.5">Dãy kệ hàng</div>
                                                    </div>
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                        {emptyCount} trống
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {aisles.length === 0 && (
                                        <div className="p-6 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-2xl">
                                            Kho này không có dãy nào có vị trí trống.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Level 3: Slot / Ô */}
                            {selectionStep === 'slot' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                            Bước 3: Chọn Ô ({getZoneName(selectedAisleId)})
                                        </label>
                                        <button 
                                            onClick={() => updateSelection({ selectionStep: 'aisle' })} 
                                            className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                                        >
                                            <ArrowLeft size={14} /> Đổi Dãy
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                        {slots.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => {
                                            const emptyCount = emptyCounts.get(z.id) || 0
                                            const isSelected = selectedSlotId === z.id
                                            return (
                                                <button
                                                    key={z.id}
                                                    onClick={() => {
                                                        updateSelection({ slotId: z.id, tierId: null })
                                                        if (activeZones.some(az => az.parent_id === z.id)) {
                                                            updateSelection({ selectionStep: 'tier' })
                                                        }
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 text-center transition-all ${
                                                        isSelected
                                                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                                                            : 'bg-white dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400 text-zinc-700 dark:text-zinc-300'
                                                    }`}
                                                >
                                                    <div className="font-black text-sm uppercase">{z.name}</div>
                                                    <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">Trống {emptyCount}</div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Level 4: Tier / Tầng */}
                            {selectionStep === 'tier' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">
                                            Bước 4: Chọn Tầng ({getZoneName(selectedSlotId)})
                                        </label>
                                        <button 
                                            onClick={() => updateSelection({ selectionStep: 'slot' })} 
                                            className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1"
                                        >
                                            <ArrowLeft size={14} /> Đổi Ô
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2.5">
                                        {tiers.filter(z => (emptyCounts.get(z.id) || 0) > 0).map(z => {
                                            const emptyCount = emptyCounts.get(z.id) || 0
                                            const isSelected = selectedTierId === z.id
                                            return (
                                                <button
                                                    key={z.id}
                                                    onClick={() => updateSelection({ tierId: z.id })}
                                                    className={`px-5 py-3.5 rounded-2xl text-xs font-black border-2 transition-all flex items-center gap-3 ${
                                                        isSelected
                                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/20'
                                                            : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-emerald-400'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 uppercase">
                                                        <span>{z.name}</span>
                                                        {isSelected && <Check size={14} />}
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        isSelected ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                                                    }`}>
                                                        {emptyCount} trống
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Start Assigning CTA Action */}
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                    {effectiveZoneId ? (
                                        <span>
                                            Khu vực đã chọn: <strong className="text-zinc-900 dark:text-white font-bold">{getZoneName(effectiveZoneId)}</strong> 
                                            {' '}(còn <strong className="text-emerald-600 font-mono">{emptyCounts.get(effectiveZoneId) || 0}</strong> vị trí trống)
                                        </span>
                                    ) : (
                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertCircle size={14} /> Vui lòng chọn ít nhất một kho hoặc khu vực để bắt đầu
                                        </span>
                                    )}
                                </div>

                                <button
                                    onClick={() => suggestNextPosition()}
                                    disabled={!effectiveZoneId || loading || isDownloading}
                                    className={`w-full sm:w-auto px-8 py-4 rounded-2xl flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wider transition-all shadow-xl ${
                                        !effectiveZoneId || loading || isDownloading
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-95'
                                    }`}
                                >
                                    <PlayCircle size={20} />
                                    <span>Bắt đầu gán vị trí</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* STEP 2: ACTIVE ASSIGNMENT / WORKING MODE */
                        <div className="bg-white dark:bg-zinc-900 border-2 border-emerald-500/40 rounded-3xl overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                            
                            {/* Working Mode Header */}
                            <div className="p-3.5 md:px-6 bg-emerald-50/70 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                                        <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                                            Khu vực đang gán:
                                        </span>
                                    </div>

                                    {/* Zone Breadcrumb Interactive Badge */}
                                    <div className="inline-flex flex-wrap items-center gap-1 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700/60 shadow-xs font-mono font-black text-xs sm:text-sm uppercase tracking-wide">
                                        <Layers size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mr-1" />
                                        
                                        {zoneParts.warehouse && (
                                            <button
                                                type="button"
                                                onClick={() => handleNavigateToZone('warehouse')}
                                                title="Bấm để chọn lại Dãy trong Kho này"
                                                className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 hover:underline underline-offset-2 decoration-emerald-500 transition-all cursor-pointer"
                                            >
                                                {zoneParts.warehouse}
                                            </button>
                                        )}

                                        {zoneParts.aisle && (
                                            <>
                                                <span className="text-zinc-400 font-normal px-0.5">&gt;</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleNavigateToZone('aisle')}
                                                    title="Bấm để chọn lại Ô trong Dãy này"
                                                    className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 hover:underline underline-offset-2 decoration-emerald-500 transition-all cursor-pointer"
                                                >
                                                    {zoneParts.aisle}
                                                </button>
                                            </>
                                        )}

                                        {zoneParts.slot && (
                                            <>
                                                <span className="text-zinc-400 font-normal px-0.5">&gt;</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleNavigateToZone('slot')}
                                                    title="Bấm để chọn lại Tầng trong Ô này"
                                                    className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 hover:underline underline-offset-2 decoration-emerald-500 transition-all cursor-pointer"
                                                >
                                                    {zoneParts.slot}
                                                </button>
                                            </>
                                        )}

                                        {zoneParts.tier && (
                                            <>
                                                <span className="text-zinc-400 font-normal px-0.5">&gt;</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleNavigateToZone('tier')}
                                                    title="Bấm để đổi Tầng"
                                                    className="text-emerald-800 dark:text-emerald-300 hover:text-emerald-600 hover:underline underline-offset-2 decoration-emerald-500 transition-all cursor-pointer"
                                                >
                                                    {zoneParts.tier}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        updateSelection({ step: 'setup' })
                                        resetPositionSelection()
                                    }}
                                    className="self-end sm:self-auto px-3.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 transition-all shadow-xs shrink-0"
                                >
                                    <ArrowLeft size={14} />
                                    <span>Đổi khu vực</span>
                                </button>
                            </div>

                            {/* Split Screen Workspace */}
                            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                
                                {/* Left Column: Target Position Display */}
                                <div className="p-6 md:p-8 flex flex-col justify-between space-y-6 bg-white dark:bg-zinc-900">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between min-h-[20px]">
                                            <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                <MapPin size={16} className="text-emerald-500" />
                                                <span>VỊ TRÍ ĐÍCH GỢI Ý</span>
                                            </label>
                                            <span className="text-[10px] text-zinc-400 font-bold uppercase">Có thể gõ đổi mã kệ</span>
                                        </div>

                                        {/* Smart Editable Position */}
                                        <div className="relative">
                                            <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500" size={28} />
                                            <input
                                                type="text"
                                                value={posSearchTerm}
                                                onChange={(e) => {
                                                    setPosSearchTerm(e.target.value.toUpperCase())
                                                    setShowPosSuggestions(true)
                                                }}
                                                onFocus={() => setShowPosSuggestions(true)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        const code = posSearchTerm.trim().toUpperCase()
                                                        const matched = navigationPositions.find(p => p.code?.toUpperCase() === code) 
                                                            || localPositions.find(p => p.code?.toUpperCase() === code)
                                                            || state.allPositions?.find((p: any) => p.code?.toUpperCase() === code)
                                                        if (matched) {
                                                            selectPosition(matched)
                                                            setShowPosSuggestions(false)
                                                        }
                                                    }
                                                }}
                                                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-5 pl-16 pr-6 text-2xl md:text-3xl font-black font-mono text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 shadow-inner uppercase"
                                                placeholder="MÃ KỆ..."
                                            />

                                            {/* Autocomplete Dropdown */}
                                            {showPosSuggestions && posSuggestions.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-100 text-left">
                                                    <div className="p-2 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-700 text-[10px] font-bold text-zinc-400 uppercase">
                                                        Gợi ý vị trí trống phù hợp:
                                                    </div>
                                                    {posSuggestions.map(p => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            onClick={() => {
                                                                selectPosition(p)
                                                            }}
                                                            className="w-full px-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-b border-zinc-50 dark:border-zinc-700 last:border-0 flex justify-between items-center text-xs"
                                                        >
                                                            <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{p.code}</span>
                                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full uppercase">Trống</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {showPosSuggestions && (
                                            <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowPosSuggestions(false)} />
                                        )}

                                        {suggestedPos?.lot_id && !suggestedPos.stt && (
                                            <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 rounded-xl border border-amber-200/80 dark:border-amber-800/50 font-bold animate-in fade-in">
                                                <span>📦 Vị trí này đang có hàng {suggestedPos.lot_code ? `(${suggestedPos.lot_code})` : ''} nhưng chưa có STT. Nhập STT bên phải để bổ sung.</span>
                                            </div>
                                        )}

                                        {/* Tips / Shortcuts row matching the Right Column */}
                                        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 font-medium px-1 gap-2 min-h-[26px]">
                                            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 font-bold">
                                                <span>📍 Thao tác vị trí:</span>
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    Phím &larr; / &rarr;: Lùi / Tiến ô
                                                </span>
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    Click ô: Chọn trực tiếp
                                                </span>
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    Gõ mã: Đổi kệ
                                                </span>
                                            </div>
                                        </div>

                                        {/* Navigation Buttons: Previous (Left) and Next (Right) */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                onClick={handlePrevPosition}
                                                disabled={loading || navigationPositions.length === 0}
                                                title="Quay lại ô trước để xem, sửa STT hoặc chọn ô khác (Phím ←)"
                                                className="w-full py-5 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base font-black uppercase tracking-wider transition-all bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-2 border-zinc-200 dark:border-zinc-700 shadow-sm active:scale-98 disabled:opacity-50 cursor-pointer"
                                            >
                                                <ArrowLeft size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                                <span>Lùi <span className="hidden sm:inline">ô trước</span> (←)</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleNextPosition}
                                                disabled={loading || navigationPositions.length === 0}
                                                title="Chuyển tới ô tiếp theo (Phím →)"
                                                className="w-full py-5 rounded-2xl flex items-center justify-center gap-2 text-sm sm:text-base font-black uppercase tracking-wider transition-all bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border-2 border-zinc-200 dark:border-zinc-700 shadow-sm active:scale-98 disabled:opacity-50 cursor-pointer"
                                            >
                                                <span>Tiến <span className="hidden sm:inline">ô sau</span> (→)</span>
                                                <ArrowRight size={20} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Left Bottom: Compact Warehouse Sheet Matrix */}
                                    {loadingSiblings && displaySiblingPositions.length === 0 ? (
                                        <div className="p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-zinc-400 min-h-[140px]">
                                            <Loader2 size={16} className="animate-spin text-emerald-600" />
                                            <span>Đang tải thông tin vị trí...</span>
                                        </div>
                                    ) : sheetData ? (
                                        <div className="w-full space-y-1.5">
                                            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1 min-h-[20px]">
                                                <span className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                                                    <Layers size={14} className="text-emerald-600" />
                                                    Sơ đồ mặt cắt Ô {sheetData.slotVal || ''} (Tầng {sheetData.tierVal || ''})
                                                </span>
                                                <span className="text-[11px] text-zinc-400">💡 Bấm ô để đổi</span>
                                            </div>

                                            <div className="bg-white dark:bg-zinc-900 border border-zinc-700 dark:border-zinc-400 rounded-xl overflow-hidden shadow-xs">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse text-center">
                                                        <thead>
                                                            {/* Header Row 1: TẦNG | STT VỊ TRÍ | KHO | DÃY | Ô */}
                                                            <tr className="border-b border-zinc-700 dark:border-zinc-400 bg-zinc-100 dark:bg-zinc-800 text-[11px] sm:text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wide">
                                                                <th rowSpan={2} className="py-1 px-1.5 border-r border-zinc-700 dark:border-zinc-400 w-14 align-middle">
                                                                    TẦNG
                                                                </th>
                                                                <th rowSpan={2} className="py-1 px-1.5 border-r border-zinc-700 dark:border-zinc-400 w-16 align-middle">
                                                                    VỊ TRÍ
                                                                </th>
                                                                <th className="py-1 px-2 border-r border-zinc-700 dark:border-zinc-400">
                                                                    KHO: <span className="font-mono text-blue-700 dark:text-blue-400 font-bold text-xs sm:text-sm">{sheetData.warehouseVal || '1'}</span>
                                                                </th>
                                                                <th className="py-1 px-2 border-r border-zinc-700 dark:border-zinc-400">
                                                                    DÃY: <span className="font-mono text-blue-700 dark:text-blue-400 font-bold text-xs sm:text-sm">{sheetData.aisleVal || '1'}</span>
                                                                </th>
                                                                <th className="py-1 px-2">
                                                                    Ô: <span className="font-mono text-blue-700 dark:text-blue-400 font-bold text-xs sm:text-sm">{sheetData.slotVal || '07'}</span>
                                                                </th>
                                                            </tr>

                                                            {/* Header Row 2: Bays (A | B | C) */}
                                                            <tr className="border-b border-zinc-700 dark:border-zinc-400 bg-zinc-50 dark:bg-zinc-800/80 text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase">
                                                                {sheetData.bays.map((bay, idx) => (
                                                                    <th 
                                                                        key={bay} 
                                                                        className={`py-0.5 px-2 font-mono font-bold ${idx < sheetData.bays.length - 1 ? 'border-r border-zinc-700 dark:border-zinc-400' : ''}`}
                                                                    >
                                                                        {bay}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>

                                                        <tbody>
                                                            {sheetData.subPositions.map((sub, sIdx) => (
                                                                <tr 
                                                                    key={sub} 
                                                                    className={sIdx < sheetData.subPositions.length - 1 ? 'border-b border-zinc-700 dark:border-zinc-400' : ''}
                                                                >
                                                                    {/* TẦNG number */}
                                                                    {sIdx === 0 && (
                                                                        <td 
                                                                            rowSpan={sheetData.subPositions.length} 
                                                                            className="py-1 px-1.5 border-r border-zinc-700 dark:border-zinc-400 font-mono font-bold text-xl text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-900 align-middle"
                                                                        >
                                                                            {sheetData.tierVal || '4'}
                                                                        </td>
                                                                    )}

                                                                    {/* STT VỊ TRÍ (e.g. 2, then 1) */}
                                                                    <td className="py-1 px-1.5 border-r border-zinc-700 dark:border-zinc-400 font-mono font-bold text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 bg-zinc-50/60 dark:bg-zinc-800/40 align-middle">
                                                                        {sub}
                                                                    </td>

                                                                    {/* Bays cells: A, B, C */}
                                                                    {sheetData.bays.map((bay, bIdx) => {
                                                                        const pos = sheetData.items.find((p: any) => p.details.bay === bay && p.details.subPos === sub)
                                                                        const isSelected = pos?.isTarget
                                                                        const hasStt = !!pos?.stt
                                                                        const isOccupiedWithoutStt = !hasStt && !!pos?.lot_id
                                                                        const isBorderRight = bIdx < sheetData.bays.length - 1

                                                                        return (
                                                                            <td
                                                                                key={bay}
                                                                                onClick={() => {
                                                                                    if (pos && !isSelected) {
                                                                                        selectPosition(pos)
                                                                                    }
                                                                                }}
                                                                                title={
                                                                                    pos
                                                                                        ? pos.stt
                                                                                            ? `Ô ${pos.code}: STT #${pos.stt} (Bấm để xem/sửa)`
                                                                                            : pos.lot_id
                                                                                                ? `Ô ${pos.code}: Có hàng (${pos.lot_code || 'Lô'}), Ko có STT (Bấm để gán)`
                                                                                                : `Ô ${pos.code}: Trống (Bấm để chọn gán)`
                                                                                        : ''
                                                                                }
                                                                                className={`py-1.5 px-2 text-center transition-all cursor-pointer ${
                                                                                    isBorderRight ? 'border-r border-zinc-700 dark:border-zinc-400' : ''
                                                                                } ${
                                                                                    isSelected
                                                                                        ? 'bg-emerald-100/90 dark:bg-emerald-950/70 ring-2 ring-emerald-500 ring-inset shadow-inner'
                                                                                        : pos?.isLocal
                                                                                            ? 'bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/60'
                                                                                            : hasStt
                                                                                                ? 'bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/30'
                                                                                                : isOccupiedWithoutStt
                                                                                                    ? 'bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/40'
                                                                                                    : 'bg-zinc-50/40 dark:bg-zinc-900/30 hover:bg-emerald-50/50'
                                                                                }`}
                                                                            >
                                                                                {pos ? (
                                                                                    <div className="flex flex-col items-center justify-center min-h-[36px]">
                                                                                        {isSelected ? (
                                                                                            <div className="inline-flex flex-col items-center">
                                                                                                <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-200/90 dark:bg-emerald-900/80 px-2 py-0.5 rounded shadow-xs">
                                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                                                                                                    {currentStt.trim() ? `#${currentStt.trim()}` : 'Đang chọn'}
                                                                                                </div>
                                                                                                {pos.stt && currentStt.trim() !== pos.stt && (
                                                                                                    <span className="text-[9px] text-zinc-400 line-through">
                                                                                                        #{pos.stt}
                                                                                                    </span>
                                                                                                )}
                                                                                                {isOccupiedWithoutStt && (
                                                                                                    <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                                                                                                        Ko có STT
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : hasStt ? (
                                                                                            <div className="font-mono font-bold text-sm sm:text-base text-blue-700 dark:text-blue-400 tracking-wide">
                                                                                                {pos.stt}
                                                                                            </div>
                                                                                        ) : isOccupiedWithoutStt ? (
                                                                                            <div className="flex flex-col items-center justify-center leading-tight">
                                                                                                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-200/70 dark:border-amber-800/50">
                                                                                                    Ko có STT
                                                                                                </span>
                                                                                                {pos.lot_code && (
                                                                                                    <span className="text-[8px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[65px] mt-0.5" title={pos.lot_code}>
                                                                                                        {pos.lot_code}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <span className="text-[10px] font-medium text-zinc-400 italic">
                                                                                                Trống
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-zinc-300">-</span>
                                                                                )}
                                                                            </td>
                                                                        )
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>

                                {/* Right Column: STT Input Form */}
                                <div className="p-6 md:p-8 flex flex-col justify-between space-y-6 bg-white dark:bg-zinc-900">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between min-h-[20px]">
                                            <label className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                <Hash size={16} className="text-emerald-500" />
                                                <span>NHẬP HOẶC QUÉT SỐ STT LÔ HÀNG</span>
                                            </label>
                                            <span className="text-[10px] text-zinc-400 font-bold uppercase">Hỗ trợ máy quét mã vạch</span>
                                        </div>

                                        <div className="relative">
                                            <Hash className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-500" size={28} />
                                            <input
                                                ref={sttInputRef}
                                                type="text"
                                                autoCapitalize="characters"
                                                value={currentStt}
                                                onChange={e => setCurrentStt(e.target.value.toUpperCase())}
                                                placeholder="STT LÔ (VD: 101, A20)..."
                                                className="w-full bg-zinc-50 dark:bg-zinc-950 border-2 border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 dark:focus:border-emerald-500 rounded-2xl py-5 pl-16 pr-6 text-2xl md:text-3xl font-black font-mono text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 shadow-inner uppercase"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        if (e.shiftKey) {
                                                            e.preventDefault()
                                                            sttInputRef.current?.select()
                                                        } else if (currentStt.trim()) {
                                                            e.preventDefault()
                                                            handleConfirmStt()
                                                        }
                                                    }
                                                    if (e.key === 'Escape') {
                                                        sttInputRef.current?.blur()
                                                    }
                                                }}
                                            />
                                        </div>

                                        {/* Quick Keyboard Shortcuts Guide */}
                                        <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 font-medium px-1 gap-2 min-h-[26px]">
                                            <span className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 font-bold">
                                                <span>⌨️ Thao tác STT:</span>
                                            </span>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    Enter: Gán / Sửa
                                                </span>
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    Esc: Thoát con trỏ
                                                </span>
                                                <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-mono font-bold">
                                                    &larr; / &rarr;: Lùi / Tiến
                                                </span>
                                                <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md font-mono font-black">
                                                    Shift + Enter: Nhập STT
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                onClick={handleConfirmStt}
                                                disabled={!currentStt.trim() || loading}
                                                className={`w-full py-5 rounded-2xl flex items-center justify-center gap-2.5 text-base font-black uppercase tracking-wider transition-all shadow-xl ${
                                                    !currentStt.trim() || loading
                                                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed shadow-none border-2 border-zinc-200 dark:border-zinc-700'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 border-2 border-emerald-600 active:scale-98 cursor-pointer'
                                                }`}
                                            >
                                                {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                                <span>{isCurrentPosAssignedThisSession ? 'Cập nhật STT vị trí (Enter)' : 'Xác nhận gán vị trí (Enter)'}</span>
                                            </button>

                                            {isCurrentPosAssignedThisSession && (
                                                <button
                                                    type="button"
                                                    onClick={handleRemoveCurrentAssignment}
                                                    className="w-full py-2.5 px-3 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all flex items-center justify-center gap-1.5 border border-red-200/60 dark:border-red-900/40 cursor-pointer"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Hủy gán cho ô này (trả về trống)</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Bottom: Symmetrical Information & Operations Card */}
                                    <div className="w-full space-y-1.5">
                                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 px-1 min-h-[20px]">
                                            <span className="font-bold flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                                                <Sparkles size={14} className="text-emerald-500" />
                                                <span>Thông tin & tiến độ gán</span>
                                            </span>
                                            <span className="text-[11px] text-zinc-400">⚡ Chế độ gán nhanh</span>
                                        </div>

                                        <div className="bg-zinc-50/60 dark:bg-zinc-800/40 border border-zinc-300 dark:border-zinc-700 rounded-xl p-3 flex flex-col justify-between min-h-[110px] shadow-xs">
                                            {lastAssignedNotice ? (
                                                <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs font-bold animate-in fade-in">
                                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                                    <span>Vừa gán thành công STT <span className="font-mono font-black underline">#{lastAssignedNotice.stt}</span> vào kệ <span className="font-mono font-black">{lastAssignedNotice.positionCode}</span></span>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                                                    <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                                                        <span>Chế độ gán mù theo STT:</span>
                                                    </div>
                                                    <p className="leading-relaxed text-[11.5px]">
                                                        Người vận hành kho chỉ cần nhập STT và gán vào kệ. Hệ thống sẽ đối chiếu, khớp mã LOT và sản phẩm thực tế khi Admin bấm <strong>Duyệt gán vị trí</strong>.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                                                <span className="text-zinc-500 font-medium">Đã gán trong phiên:</span>
                                                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                                                    {assignments.length} vị trí
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Section: Staged Queue & Sync Actions */}
                {assignments.length > 0 && (
                    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                                    <Sparkles size={18} className="text-amber-500" />
                                    <span>Hàng chờ gán ({assignments.length})</span>
                                </h3>
                                <p className="text-xs text-zinc-400 mt-0.5">Lưu tạm tại trình duyệt, sẵn sàng đồng bộ lên hệ thống</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    onClick={() => {
                                        if (confirm('⚠️ Bạn có chắc muốn xóa sạch toàn bộ hàng chờ?')) {
                                            clearAssignments()
                                        }
                                    }}
                                    title="Xóa toàn bộ danh sách"
                                    className="px-3 py-2 text-zinc-500 hover:text-red-600 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition-all flex items-center gap-1.5"
                                >
                                    <Trash2 size={14} />
                                    <span>Xóa tất cả</span>
                                </button>

                                <button
                                    onClick={syncAssignments}
                                    disabled={isSyncing || assignments.length === 0}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    {isSyncing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    <span>ĐỒNG BỘ LÊN HỆ THỐNG ({assignments.length})</span>
                                </button>

                                <Link
                                    href="/production-lot/assignments"
                                    className="px-3.5 py-2 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1"
                                >
                                    <span>Duyệt Gán Vị Trí</span>
                                    <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>

                        {/* List of Staged Items as a responsive grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1">
                            {assignments.map((ass: PendingAssignment, idx: number) => (
                                <div
                                    key={ass.positionId || idx}
                                    className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-100 dark:border-zinc-700/60 flex items-center justify-between group hover:border-emerald-300 dark:hover:border-emerald-700 transition-all text-xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-mono font-black shrink-0">
                                            #{ass.stt}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                                                <MapPin size={11} className="text-red-500 shrink-0" />
                                                <span className="truncate">{ass.positionCode}</span>
                                            </div>
                                            <div className="text-[10px] text-zinc-400">
                                                {ass.productionDate}
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => removeAssignment(ass.positionId)}
                                        title="Xóa mục này"
                                        className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-red-600 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-all opacity-70 group-hover:opacity-100"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
