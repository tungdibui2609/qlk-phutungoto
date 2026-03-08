'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ClipboardCheck, Plus, Loader2, ChevronRight, ChevronDown, ChevronUp, Layers, Check, Trash2, X, Calendar, User, Users, BarChart3, CheckCircle2, LayoutGrid, Eye, Package, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { format } from 'date-fns'

// Types
interface Session {
    id: string
    name: string
    status: string
    warehouse_id: string | null
    system_code: string
    company_id: string | null
    created_by: string | null
    created_at: string
    completed_at: string | null
    note: string | null
    creator_name?: string
    warehouse_name?: string
    warehouse_path?: string
    participants?: string[]
    participant_names?: string[]
    stats?: { total: number; checked: number; discrepancy: number }
}

interface InvItem {
    id: string
    session_id: string
    position_id: string
    zone_id: string | null
    checked: boolean
    note: string | null
    checked_by: string | null
    checked_at: string | null
    lot_id_snapshot: string | null
}

interface Zone {
    id: string
    name: string
    code: string
    parent_id: string | null
    level: number | null
    display_order: number | null
    is_hall?: boolean | null
    system_type?: string | null
    company_id?: string | null
    created_at?: string | null
}

interface Position {
    id: string
    code: string
    lot_id: string | null
    zone_id?: string | null
}

// Batch fetching helper to bypass Supabase's 1000-row limit
async function fetchAll(query: any) {
    let allData: any[] = []
    let from = 0
    let to = 999
    let finished = false

    // Ensure we have a stable sort by ID if not already sorted, to avoid duplicates across pages
    const stableQuery = query.order('id', { ascending: true })

    while (!finished) {
        const { data, error } = await stableQuery.range(from, to)
        if (error) throw error
        if (!data || data.length === 0) {
            finished = true
        } else {
            allData = [...allData, ...data]
            if (data.length < 1000) {
                finished = true
            } else {
                from += 1000
                to += 1000
            }
        }
    }

    // Deduplicate by ID just in case
    const seen = new Set()
    return allData.filter(item => {
        if (!item.id) return true
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

export default function InternalInventoryPage() {
    const { systemType, currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState<Session[]>([])
    const [selectedSession, setSelectedSession] = useState<Session | null>(null)

    // Detail view state
    const [zones, setZones] = useState<Zone[]>([])
    const [positions, setPositions] = useState<Position[]>([])
    const [items, setItems] = useState<InvItem[]>([])
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})
    const [detailLoading, setDetailLoading] = useState(false)
    const [showHallSummary, setShowHallSummary] = useState(false)
    const [isGroupingEnabled, setIsGroupingEnabled] = useState(true)

    // Create modal
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newSelectionPath, setNewSelectionPath] = useState<string[]>([])
    const [allZonesForCreate, setAllZonesForCreate] = useState<Zone[]>([])
    const [allUsers, setAllUsers] = useState<{ id: string, full_name: string }[]>([])
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
    const [zonesLoading, setZonesLoading] = useState(false)
    const [creating, setCreating] = useState(false)

    // Filter & Expansion
    const [selectedWh, setSelectedWh] = useState<string | null>(null)
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

    // ======== FETCH SESSIONS ========
    const fetchSessions = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            const [sessionsRes, rawZones, rawSysPos, rawZP] = await Promise.all([
                supabase.from('internal_inventory_sessions').select('*').eq('system_code', systemType).order('created_at', { ascending: false }),
                fetchAll(supabase.from('zones').select('id, name, parent_id, display_order, is_hall')),
                fetchAll(supabase.from('positions').select('id, system_type, lot_id').eq('system_type', systemType)),
                fetchAll(supabase.from('zone_positions').select('zone_id, position_id'))
            ])

            if (sessionsRes.error) throw sessionsRes.error
            const data = sessionsRes.data || []

            const userIds = [...new Set((data || []).map(s => s.created_by).filter(Boolean))]
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds as string[])
                users?.forEach((u: any) => { userMap[u.id] = u.full_name })
            }

            const whIds = [...new Set((data || []).map(s => s.warehouse_id).filter(Boolean))]
            let whMap: Record<string, string> = {}
            if (whIds.length > 0) {
                const { data: whs } = await supabase.from('zones').select('id, name').in('id', whIds as string[])
                whs?.forEach((w: any) => { whMap[w.id] = w.name })
            }

            // Map zones to positions before grouping
            const rawZPMap: Record<string, string> = {}
            rawZP.forEach((rp: any) => { rawZPMap[rp.position_id] = rp.zone_id })
            const enrichedPos = rawSysPos.map((p: any) => ({ ...p, zone_id: rawZPMap[p.id] || null }))

            // Apply grouping to EVERYTHING to get virtual IDs for stats calculation
            const { zones: groupedZones, positions: groupedPos } = groupWarehouseData(rawZones as any, enrichedPos as any)
            const zoneMap: Record<string, { name: string, parent_id: string | null }> = {}
            groupedZones.forEach(z => { zoneMap[z.id] = { name: z.name, parent_id: z.parent_id } })

            const isDescendant = (childId: string | null, parentId: string): boolean => {
                if (!childId || childId === parentId) return childId === parentId
                let cur: any = groupedZones.find(x => x.id === childId)
                while (cur && cur.parent_id) {
                    if (cur.parent_id === parentId) return true
                    cur = groupedZones.find(x => x.id === cur.parent_id)
                }
                return false
            }

            const sessionIds = (data || []).map(s => s.id)
            let statsMap: Record<string, { total: number; checked: number; discrepancy: number }> = {}

            if (sessionIds.length > 0) {
                const allItems = await fetchAll(supabase.from('internal_inventory_items').select('session_id, checked, note').in('session_id', sessionIds))

                data?.forEach(s => {
                    let virtualWhId: string | null = null
                    try {
                        if (s.note && s.note.startsWith('{')) {
                            const parsed = JSON.parse(s.note)
                            virtualWhId = parsed.v || null
                        }
                    } catch (e) { }

                    const effectiveWhId = s.warehouse_id || virtualWhId
                    let total = 0
                    if (effectiveWhId) {
                        total = groupedPos.filter(p => p.zone_id && isDescendant(p.zone_id, effectiveWhId)).length
                    } else {
                        total = groupedPos.length
                    }
                    statsMap[s.id] = { total, checked: 0, discrepancy: 0 }
                })

                allItems?.forEach((item: any) => {
                    if (statsMap[item.session_id]) {
                        if (item.checked) statsMap[item.session_id].checked++
                        if (item.note) statsMap[item.session_id].discrepancy++
                    }
                })
            }

            const getZonePath = (zid: string | null): string => {
                if (!zid || !zoneMap[zid]) return 'Tất cả kho'
                const parts = []
                let cur = zid
                while (cur && zoneMap[cur]) {
                    parts.unshift(zoneMap[cur].name)
                    cur = zoneMap[cur].parent_id || ''
                }
                return parts.join(' > ')
            }

            // Fetch member names from construction_members for participants
            const allParticipantIds = [...new Set((data || []).flatMap(s => {
                try {
                    if (s.note && s.note.startsWith('{\"p\":')) {
                        const parsed = JSON.parse(s.note)
                        return parsed.p || []
                    }
                } catch (e) { }
                return []
            }))]

            let memberMap: Record<string, string> = {}
            if (allParticipantIds.length > 0) {
                const { data: membersData } = await (supabase.from('construction_members') as any).select('id, full_name').in('id', allParticipantIds)
                membersData?.forEach((m: any) => { memberMap[m.id] = m.full_name })
            }

            setSessions((data || []).map(s => {
                let participants: string[] = []
                let virtualWhId: string | null = null
                try {
                    if (s.note && s.note.startsWith('{')) {
                        const parsed = JSON.parse(s.note)
                        participants = parsed.p || []
                        virtualWhId = parsed.v || null
                    }
                } catch (e) { }

                const effectiveWhId = s.warehouse_id || virtualWhId
                return {
                    ...s,
                    creator_name: s.created_by ? userMap[s.created_by as string] || 'N/A' : 'N/A',
                    warehouse_name: effectiveWhId ? (zoneMap[effectiveWhId]?.name || 'N/A') : 'Tất cả kho',
                    warehouse_path: getZonePath(effectiveWhId),
                    participants,
                    participant_names: participants.map(id => memberMap[id] || 'N/A').filter(n => n !== 'N/A'),
                    stats: statsMap[s.id] || { total: 0, checked: 0, discrepancy: 0 }
                }
            }))
        } catch (e: any) {
            showToast('Lỗi tải danh sách phiếu: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, showToast, profile?.company_id])

    useEffect(() => { fetchSessions() }, [fetchSessions])

    useEffect(() => {
        if (!systemType) return
        const fetchAllZones = async () => {
            setZonesLoading(true)
            try {
                let query = supabase
                    .from('zones')
                    .select('id, name, parent_id, display_order, system_type')

                // Fetch users for selection from construction_members (as requested)
                if (systemType) {
                    const { data: usersData } = await (supabase.from('construction_members') as any).select('id, full_name').eq('system_code', systemType)
                    setAllUsers(usersData || [])
                }

                const rawResult = await fetchAll(query.order('display_order', { ascending: true }))
                if (rawResult) {
                    const unique = Array.from(new Map(rawResult.map((z: any) => [z.id, z])).values()) as any as Zone[]

                    // Group cells to create virtual options for selection
                    const { zones: groupedResult } = groupWarehouseData(unique as any, [])

                    // Natural sort by name to ensure Kho 1 < Kho 2 < Kho 10
                    groupedResult.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                    setAllZonesForCreate(groupedResult as any)
                }
            } catch (err) {
                console.error("Fetch all zones error:", err)
            } finally {
                setZonesLoading(false)
            }
        }
        fetchAllZones()
    }, [systemType, profile?.company_id])

    const handleCreate = async () => {
        if (!systemType || !profile) return
        setCreating(true)
        const lastSelectionId = newSelectionPath.length > 0 ? newSelectionPath[newSelectionPath.length - 1] : null
        const isVirtual = lastSelectionId?.startsWith('v-')

        try {
            const { data, error } = await supabase
                .from('internal_inventory_sessions')
                .insert({
                    name: newName.trim() || `Phiếu kiểm ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
                    status: 'active',
                    system_code: systemType,
                    company_id: profile.company_id,
                    created_by: profile.id,
                    warehouse_id: isVirtual ? null : lastSelectionId,
                    note: JSON.stringify({
                        p: selectedUserIds,
                        v: isVirtual ? lastSelectionId : null
                    })
                })
                .select().single()
            if (error) throw error
            showToast(`Đã tạo: ${data.name}`, 'success')
            setIsCreateOpen(false)
            setNewName('')
            setNewSelectionPath([])
            fetchSessions()
        } catch (e: any) {
            showToast('Lỗi tạo phiếu: ' + e.message, 'error')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id: string) => {
        const ok = await showConfirm('Xóa phiếu kiểm này? Dữ liệu sẽ bị mất vĩnh viễn.')
        if (!ok) return
        try {
            const { error } = await supabase.from('internal_inventory_sessions').delete().eq('id', id)
            if (error) throw error
            showToast('Đã xóa phiếu kiểm', 'success')
            if (selectedSession?.id === id) setSelectedSession(null)
            fetchSessions()
        } catch (e: any) {
            showToast('Lỗi xóa: ' + e.message, 'error')
        }
    }

    const loadDetail = useCallback(async (session: Session) => {
        if (!systemType) return
        setDetailLoading(true)
        setSelectedSession(session)
        try {
            let virtualWhId: string | null = null
            try {
                if (session.note && session.note.startsWith('{')) {
                    const parsed = JSON.parse(session.note)
                    virtualWhId = parsed.v || null
                }
            } catch (e) { }

            const [rawZonesData, rawPosData, zpData, itemsData] = await Promise.all([
                fetchAll(supabase.from('zones').select('id, name, code, parent_id, level, display_order, is_hall, system_type')),
                fetchAll(supabase.from('positions').select('id, code, lot_id, system_type').eq('system_type', systemType)),
                fetchAll(supabase.from('zone_positions').select('zone_id, position_id')),
                fetchAll(supabase.from('internal_inventory_items').select('*').eq('session_id', session.id)),
            ])

            // Map zones to positions before grouping
            const rawZPMap: Record<string, string> = {}
            zpData.forEach((rp: any) => { rawZPMap[rp.position_id] = rp.zone_id })
            const enrichedPos = rawPosData.map((p: any) => ({ ...p, zone_id: rawZPMap[p.id] || null }))

            // Remap positions to virtual zones using groupWarehouseData
            const { zones: zonesData, positions: posData } = groupWarehouseData(rawZonesData as any, enrichedPos as any)

            const zpMap: Record<string, string> = {}
            posData.forEach((p: any) => { zpMap[p.id] = p.zone_id })

            const effectiveWhId = session.warehouse_id || virtualWhId
            let filteredPositions = posData
            if (effectiveWhId) {
                const targetId: string = effectiveWhId
                if (targetId.startsWith('v-')) {
                    setIsGroupingEnabled(true)
                }
                const isDescendant = (childId: string | null, parentId: string): boolean => {
                    if (!childId || childId === parentId) return childId === parentId
                    let cur: any = (zonesData as any[]).find((x: any) => x.id === childId)
                    while (cur && cur.parent_id) {
                        if (cur.parent_id === parentId) return true
                        cur = (zonesData as any[]).find((x: any) => x.id === cur.parent_id)
                    }
                    return false
                }
                const allowedZoneIds = (zonesData as any[]).filter((z: any) => isDescendant(z.id, targetId)).map((z: any) => z.id)
                filteredPositions = posData.filter((p: any) => zpMap[p.id] && allowedZoneIds.includes(zpMap[p.id]))
            }

            const posWithZone = filteredPositions.map((p: any) => ({ ...p, zone_id: zpMap[p.id] || null }))

            setZones(zonesData as any as Zone[] || [])
            setPositions(posWithZone)
            setItems(itemsData || [])

            const isRoot = (z: Zone) => !z.parent_id || z.parent_id === ''
            const whList = (zonesData as any as Zone[]).filter(isRoot).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))

            // Priority for selectedWh: effectiveWhId (specifically its root) > first warehouse in list
            if (effectiveWhId) {
                const getRoot = (zid: string): string => {
                    const z = (zonesData as any[]).find(x => x.id === zid)
                    if (!z || !z.parent_id || z.parent_id === '') return zid
                    return getRoot(z.parent_id)
                }
                const rootWhId = getRoot(effectiveWhId)
                setSelectedWh(rootWhId)
            } else if (whList.length > 0) {
                setSelectedWh(whList[0].id)
            }

            const lotIds = [...new Set(posWithZone.map((p: any) => p.lot_id).filter(Boolean))] as string[]
            if (lotIds.length > 0) {
                const { data: lots } = await supabase
                    .from('lots')
                    .select('id, code, lot_items(id, quantity, unit, products(name, sku, color)), lot_tags(tag)')
                    .in('id', lotIds)

                const infoMap: Record<string, any> = {}
                lots?.forEach((l: any) => {
                    infoMap[l.id] = {
                        code: l.code,
                        tags: l.lot_tags?.map((t: any) => t.tag) || [],
                        items: l.lot_items?.map((li: any) => ({
                            product_name: li.products?.name,
                            sku: li.products?.sku,
                            product_color: li.products?.color,
                            quantity: li.quantity,
                            unit: li.unit || li.products?.unit,
                        })) || []
                    }
                })
                setLotInfo(infoMap)
            }
        } catch (e: any) {
            showToast('Lỗi tải chi tiết: ' + e.message, 'error')
        } finally {
            setDetailLoading(false)
        }
    }, [systemType, showToast, profile?.company_id])

    const toggleCheck = async (positionId: string) => {
        if (!selectedSession || !profile) return
        const existing = items.find(i => i.position_id === positionId)
        const newChecked = !existing?.checked

        setItems(prev => {
            if (existing) return prev.map(i => i.position_id === positionId ? { ...i, checked: newChecked, checked_at: new Date().toISOString() } : i)
            const pos = positions.find(p => p.id === positionId)
            return [...prev, {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: pos?.zone_id || null,
                checked: true,
                note: null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null
            }]
        })

        try {
            const pos = positions.find(p => p.id === positionId)
            await supabase.from('internal_inventory_items').upsert({
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: pos?.zone_id || null,
                checked: newChecked,
                note: existing?.note || null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null,
            }, { onConflict: 'session_id,position_id' })
        } catch (e) {
            console.error('Check toggle error:', e)
        }
    }

    const updateNote = async (positionId: string, note: string) => {
        if (!selectedSession || !profile) return
        const existing = items.find(i => i.position_id === positionId)

        setItems(prev => {
            if (existing) return prev.map(i => i.position_id === positionId ? { ...i, note } : i)
            const pos = positions.find(p => p.id === positionId)
            return [...prev, {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: pos?.zone_id || null,
                checked: false,
                note,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null
            }]
        })

        try {
            const pos = positions.find(p => p.id === positionId)
            await supabase.from('internal_inventory_items').upsert({
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: pos?.zone_id || null,
                checked: existing?.checked || false,
                note,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null,
            }, { onConflict: 'session_id,position_id' })
        } catch (e) {
            console.error('Note update error:', e)
        }
    }

    const bulkCheck = async (pids: string[], checked: boolean) => {
        if (!selectedSession || !profile || pids.length === 0) return
        const upserts = pids.map(pid => {
            const pos = positions.find(p => p.id === pid)
            const existing = items.find(i => i.position_id === pid)
            return {
                session_id: selectedSession.id,
                position_id: pid,
                zone_id: pos?.zone_id || null,
                checked,
                note: existing?.note || null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null,
            }
        })

        setItems(prev => {
            const next = [...prev]
            pids.forEach(pid => {
                const idx = next.findIndex(i => i.position_id === pid)
                if (idx >= 0) {
                    next[idx] = { ...next[idx], checked }
                } else {
                    const pos = positions.find(p => p.id === pid)
                    next.push({
                        id: crypto.randomUUID(),
                        session_id: selectedSession.id,
                        position_id: pid,
                        zone_id: pos?.zone_id || null,
                        checked,
                        note: null,
                        checked_by: profile.id,
                        checked_at: new Date().toISOString(),
                        lot_id_snapshot: pos?.lot_id || null
                    })
                }
            })
            return next
        })

        try {
            await supabase.from('internal_inventory_items').upsert(upserts, { onConflict: 'session_id,position_id' })
            showToast(`Đã ${checked ? 'kiểm' : 'bỏ kiểm'} ${pids.length} vị trí`, 'success')
        } catch (e: any) {
            showToast('Lỗi tích hàng loạt: ' + e.message, 'error')
        }
    }

    const itemsMap = useMemo(() => {
        const map: Record<string, InvItem> = {}
        items.forEach(i => { map[i.position_id] = i })
        return map
    }, [items])

    const effectiveWhId = useMemo(() => {
        if (!selectedSession) return null
        let virtualWhId: string | null = null
        try {
            if (selectedSession.note && selectedSession.note.startsWith('{')) {
                const parsed = JSON.parse(selectedSession.note)
                virtualWhId = parsed.v || null
            }
        } catch (e) { }
        return selectedSession.warehouse_id || virtualWhId
    }, [selectedSession])

    const groupedData = useMemo(() => {
        if (!isGroupingEnabled) return { zones, positions }
        return groupWarehouseData(zones as any, positions as any)
    }, [isGroupingEnabled, zones, positions])

    const sortedZones = useMemo(() => {
        return [...groupedData.zones].sort((a, b) => {
            if ((a.display_order ?? 0) !== (b.display_order ?? 0)) {
                return (a.display_order ?? 0) - (b.display_order ?? 0)
            }
            return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
        })
    }, [groupedData.zones])

    const warehouses = useMemo(() => {
        const roots = sortedZones.filter(z => !z.parent_id || z.parent_id === '')
        if (effectiveWhId) {
            const getRoot = (zid: string): string => {
                const z = sortedZones.find(x => x.id === zid)
                if (!z || !z.parent_id || z.parent_id === '') return zid
                return getRoot(z.parent_id)
            }
            const rootId = getRoot(effectiveWhId)
            return roots.filter(r => r.id === rootId)
        }
        return roots
    }, [sortedZones, effectiveWhId])

    const childrenMap = useMemo(() => {
        const map: Record<string, Zone[]> = {}
        sortedZones.forEach(z => {
            if (z.parent_id && z.parent_id !== '') {
                if (!map[z.parent_id]) map[z.parent_id] = []
                map[z.parent_id].push(z)
            }
        })
        return map
    }, [sortedZones])

    const getDescendantIds = useCallback((pid: string): string[] => {
        const ch = childrenMap[pid] || []
        const ids = ch.reduce((acc: string[], c) => [...acc, c.id, ...getDescendantIds(c.id)], [pid])
        return [...new Set(ids)]
    }, [childrenMap])

    const getZoneStats = useCallback((zoneId: string) => {
        const ids = getDescendantIds(zoneId)
        const zonePos = groupedData.positions.filter(p => p.zone_id && ids.includes(p.zone_id))
        const total = zonePos.length
        const occupied = zonePos.filter(p => p.lot_id).length
        const checked = zonePos.filter(p => itemsMap[p.id]?.checked).length
        const discrepancy = zonePos.filter(p => itemsMap[p.id]?.note).length
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0
        return { total, occupied, checked, discrepancy, pct }
    }, [getDescendantIds, groupedData.positions, itemsMap])

    const buildingChildren = useMemo(() => {
        if (!selectedWh) return []
        const children = childrenMap[selectedWh] || []

        if (effectiveWhId) {
            const targetId = effectiveWhId

            // Is targetId the selectedWh? Show its children.
            if (targetId === selectedWh) return children

            // Is targetId a direct child of selectedWh? Show only that child.
            const directChild = children.find(c => c.id === targetId)
            if (directChild) return [directChild]

            // Is targetId a deeper descendant? We should show the ancestor that is a direct child of selectedWh.
            const findAncestorInLevel1 = (zid: string): Zone | null => {
                let cur = sortedZones.find(z => z.id === zid)
                while (cur && cur.parent_id && cur.parent_id !== selectedWh) {
                    cur = sortedZones.find(z => z.id === cur?.parent_id)
                }
                return (cur && cur.parent_id === selectedWh) ? cur : null
            }
            const ancestor = findAncestorInLevel1(targetId)
            if (ancestor) return [ancestor]

            // If the effectiveWhId is NOT under selectedWh, don't show any level 1 cards
            // because they are irrelevant.
            return []
        }

        return children
    }, [selectedWh, childrenMap, effectiveWhId, sortedZones])

    const hallSummary = useMemo(() => {
        const dZone = sortedZones.find(z => z.id === selectedWh)
        if (!dZone?.is_hall) return []
        const groups: Record<string, any> = {}
        const dZoneIds = effectiveWhId ? getDescendantIds(effectiveWhId) : getDescendantIds(dZone.id)
        const dPositions = groupedData.positions.filter(p => p.zone_id && dZoneIds.includes(p.zone_id))
        dPositions.forEach((p: any) => {
            const lot = p.lot_id ? lotInfo[p.lot_id] : null
            if (!lot || !lot.items) return
            lot.items.forEach((it: any) => {
                const groupKey = `${it.sku}|${it.quantity}|${it.unit}`;
                const res = itemsMap[p.id] || { checked: false, note: null }
                if (!groups[groupKey]) {
                    groups[groupKey] = { sku: it.sku, name: it.product_name, quantity: it.quantity, unit: it.unit, count: 1, checkedCount: res.checked ? 1 : 0, notes: res.note ? [res.note] : [] }
                } else {
                    groups[groupKey].count++
                    if (res.checked) groups[groupKey].checkedCount++
                    if (res.note) groups[groupKey].notes.push(res.note)
                }
            })
        })
        return Object.values(groups).sort((a: any, b: any) => a.sku.localeCompare(b.sku))
    }, [selectedWh, sortedZones, groupedData.positions, lotInfo, itemsMap, getDescendantIds])

    const toggleExpand = (id: string) => {
        setExpandedZones(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    const expandLevel1 = () => {
        if (!selectedWh) return
        const children = childrenMap[selectedWh] || []
        setExpandedZones(new Set(children.map(c => c.id)))
    }

    const expandLevel2 = () => {
        if (!selectedWh) return
        const allIds = getDescendantIds(selectedWh)
        setExpandedZones(new Set(allIds))
    }

    const collapseAll = () => {
        setExpandedZones(new Set())
    }

    const renderInventoryPosition = (pos: any) => {
        const item = itemsMap[pos.id]
        const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
        const hasNote = !!item?.note

        return (
            <div
                key={pos.id}
                className={`p-3 pb-1.5 rounded-xl border-2 shadow-sm relative flex flex-col items-center gap-y-2 min-h-[150px] text-center overflow-hidden transition-all ${hasNote ? 'bg-red-50/80 border-red-500 ring-1 ring-red-200' : 'bg-white border-stone-900'}`}
            >
                {/* 1. Header: Mã vị trí | Mã LOT (Color Coded) */}
                <div className="w-full flex items-center justify-center relative border-b border-stone-100 pb-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black text-indigo-600 uppercase tracking-tight">
                            {pos.code}
                        </span>
                        {lot && (
                            <>
                                <span className="text-stone-300">|</span>
                                <span className="text-[12px] font-bold text-amber-600 uppercase tracking-tight">
                                    LOT: {lot.code}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* 2 -> 5 Content Area (Vertical & Centered) */}
                <div className="flex-1 w-full py-1 flex flex-col justify-center items-center gap-0.5">
                    {lot ? (
                        <div className="w-full flex flex-col items-center space-y-1">
                            {lot.items?.map((li: any, i: number) => (
                                <div key={i} className="flex flex-col items-center w-full space-y-0.5">
                                    {/* Tên sản phẩm */}
                                    <p className="text-[12px] font-extrabold text-stone-900 uppercase tracking-tight w-full px-2 leading-tight">
                                        {li.product_name || li.sku}
                                    </p>

                                    {/* Mã sản phẩm | Mã phụ (Tags) */}
                                    <div className="flex items-center justify-center gap-2 flex-wrap">
                                        <p className="text-[10px] font-black text-stone-400 uppercase tracking-tighter">{li.sku}</p>
                                        {lot.tags && lot.tags.length > 0 && (
                                            <div className="flex gap-0.5">
                                                {lot.tags.map((t: string, idx: number) => (
                                                    <span key={idx} className="text-[7px] font-black bg-stone-100 text-stone-900 border border-stone-200 px-1 rounded uppercase">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Số lượng : Đơn vị */}
                                    <p className="text-[14px] font-black text-stone-900">
                                        SL: {li.quantity} <span className="text-[10px] font-bold text-stone-500 uppercase">{li.unit}</span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 opacity-20 py-2">
                            <Package size={28} className="text-stone-300" />
                            <span className="text-[11px] font-black uppercase tracking-[0.2em] italic text-stone-900">Vị trí hiện trống</span>
                        </div>
                    )}
                </div>

                {/* 6. Ghi chú sai lệch (Direct Input - Footer Fixed) */}
                <div className={`w-full mt-auto pt-1 border-t border-stone-100 px-2 pb-1 rounded-md transition-colors shrink-0 ${hasNote ? 'bg-red-50/50 border-red-200' : 'bg-transparent border-transparent'}`}>
                    <input
                        key={pos.id}
                        type="text"
                        defaultValue={item?.note || ''}
                        onBlur={(e) => updateNote(pos.id, e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                        placeholder="Nhập ghi chú..."
                        className={`w-full bg-transparent text-[10px] font-extrabold italic text-center outline-none placeholder:text-stone-200 py-1 transition-colors ${hasNote ? 'text-red-500' : 'text-stone-300 focus:text-stone-900'}`}
                    />
                </div>
            </div>
        )
    }

    const renderZoneTree = (zoneId: string, depth: number = 0, breadcrumb: string[] = []): React.ReactNode => {
        const children = childrenMap[zoneId] || []
        const zonePos = groupedData.positions
            .filter(p => p.zone_id === zoneId)
            .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

        // Filter children and positions based on effectiveWhId
        const filteredChildren = children.filter(c => {
            if (!effectiveWhId) return true
            const cDescendants = getDescendantIds(c.id)
            const targetDescendants = getDescendantIds(effectiveWhId)
            return c.id === effectiveWhId || cDescendants.includes(effectiveWhId) || targetDescendants.includes(c.id)
        })

        const filteredPos = zonePos.filter(p => {
            if (!effectiveWhId) return true
            // Only show positions if the current zone is the target or a descendant of the target
            return zoneId === effectiveWhId || getDescendantIds(effectiveWhId).includes(zoneId)
        })

        const isExpanded = expandedZones.has(zoneId)
        const zone = sortedZones.find(z => z.id === zoneId)
        if (!zone) return null

        const hasDirectPositions = filteredPos.length > 0
        const hasChildren = filteredChildren.length > 0

        // If no children and no positions after filtering, and this is not an ancestor path, hide
        if (!hasChildren && !hasDirectPositions && effectiveWhId && zoneId !== effectiveWhId && !getDescendantIds(zoneId).includes(effectiveWhId)) {
            return null
        }

        const currentBreadcrumb = [...breadcrumb, zone.name]
        const isDãy = zone.name.toUpperCase().includes('DÃY') || zone.name.toUpperCase().includes('SẢNH') || !zone.parent_id
        const isBigBin = isGroupingEnabled && (zone.id.startsWith('v-bin-') || zone.name.startsWith('Ô '))
        const isLevelUnderBin = isGroupingEnabled && (zone.id.startsWith('v-lvl-') || zone.name.toUpperCase().startsWith('TẦNG '))

        const s = getZoneStats(zoneId)

        // STYLE 1: DÃY / SẢNH (Green Header)
        if (isDãy && !isBigBin && !isLevelUnderBin) {
            return (
                <div key={zoneId} className="mb-4">
                    <div
                        className="flex items-center justify-between p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl cursor-pointer hover:bg-emerald-100/50 transition-all shadow-sm"
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-1.5 h-10 bg-emerald-500 rounded-full" />
                            <div className="flex items-center gap-3">
                                {isExpanded ? <ChevronDown size={24} className="text-emerald-600" /> : <ChevronRight size={24} className="text-emerald-600" />}
                                <div>
                                    <h2 className="text-lg font-black text-stone-900 tracking-tight uppercase">{zone.name}</h2>
                                    <p className="text-xs font-bold text-stone-500">{s.total} vị trí</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden sm:flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-xl border border-emerald-100">
                                <span className="text-[10px] font-black text-emerald-600">{s.checked}/{s.total}</span>
                                <div className="w-20 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${s.pct}%` }} />
                                </div>
                                <span className="text-[10px] font-black text-emerald-600">{s.pct}%</span>
                            </div>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className={`mt-4 ${isGroupingEnabled ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-4'}`}>
                            {filteredChildren.map(child => renderZoneTree(child.id, depth + 1, isGroupingEnabled ? currentBreadcrumb : []))}
                            {hasDirectPositions && (
                                <div className="flex flex-col gap-2 px-2">
                                    {filteredPos.map(pos => renderInventoryPosition(pos))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )
        }

        // STYLE 2: Ô (White Card inside Grid)
        if (isBigBin) {
            const hasErr = s.discrepancy > 0
            return (
                <div key={zoneId} className={`border rounded-2xl p-4 shadow-sm hover:shadow-md transition-all ${hasErr ? 'bg-red-50/50 border-red-200 ring-1 ring-red-100' : 'bg-white border-stone-100'}`}>
                    <div
                        className="flex items-center justify-between mb-4 cursor-pointer"
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className={`flex items-center gap-2 ${hasErr ? 'text-red-700' : 'text-stone-900'}`}>
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            <span className="text-base font-black tracking-tight">{zone.name}</span>
                            <span className={`${hasErr ? 'bg-red-600' : 'bg-blue-500'} text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-1 animate-pulse`}>
                                {s.total} vị trí {hasErr && '• SAI LỆCH'}
                            </span>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="space-y-4">
                            {filteredChildren.map(child => renderZoneTree(child.id, depth + 1, currentBreadcrumb))}
                        </div>
                    )}
                </div>
            )
        }

        // STYLE 3: TẦNG (Breadcrumb style with Green Bar)
        if (isLevelUnderBin) {
            const bcText = currentBreadcrumb.join(' • ')
            const hasErr = s.discrepancy > 0
            return (
                <div key={zoneId} className={`space-y-3 p-2 rounded-xl transition-colors ${hasErr ? 'bg-red-50/30' : ''}`}>
                    <div
                        className={`flex items-center justify-between border-b pb-2 cursor-pointer group ${hasErr ? 'border-red-200' : 'border-stone-100'}`}
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-1 h-6 rounded-full ${hasErr ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                            <h3 className={`text-[11px] font-black font-mono uppercase tracking-tighter ${hasErr ? 'text-red-600' : 'text-stone-500'}`}>
                                {bcText} | {s.total} VỊ TRÍ {hasErr && '• CÓ SAI LỆCH'}
                            </h3>
                        </div>
                        <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={14} className={hasErr ? 'text-red-400' : 'text-stone-300'} /> : <ChevronDown size={14} className={hasErr ? 'text-red-400' : 'text-stone-300'} />}
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="flex flex-col gap-2">
                            {filteredPos.map(pos => renderInventoryPosition(pos))}
                        </div>
                    )}
                </div>
            )
        }

        return (
            <div key={zoneId} className={`${depth > 0 ? 'ml-4 border-l border-stone-100 pl-3' : ''}`}>
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-stone-50 transition-all text-left group"
                    onClick={() => toggleExpand(zoneId)}
                    role="button"
                >
                    <div className="flex items-center gap-2 flex-1 pointer-events-none">
                        {(hasChildren || hasDirectPositions) && (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        <span className="text-sm font-semibold text-stone-700">
                            {zone.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                        <span className="bg-stone-100 px-2 py-0.5 rounded font-bold text-stone-400">TIẾN ĐỘ: {s.checked}/{s.total}</span>
                        {s.discrepancy > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded font-bold">{s.discrepancy} !</span>}
                        <span className={`font-bold ${s.pct === 100 ? 'text-green-600' : 'text-stone-400'}`}>{s.pct}%</span>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-1">
                        {filteredChildren.map(child => renderZoneTree(child.id, depth + 1, currentBreadcrumb))}
                        {hasDirectPositions && (
                            <div className={
                                zone.is_hall
                                    ? 'flex flex-row overflow-x-auto gap-2 py-3 px-2 scrollbar-hide'
                                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 py-2 px-2'
                            }>
                                {filteredPos.map(pos => renderInventoryPosition(pos))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="p-2 md:p-4 w-full mx-auto space-y-6 pb-24 h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                        <ClipboardCheck className="text-purple-600" />
                        Kiểm Kê Nội Bộ
                    </h1>
                    <p className="text-stone-500 mt-1">Kiểm tra vật lý từng vị trí trong kho — đồng bộ với ứng dụng mobile</p>
                </div>
                <button onClick={() => { setNewName(''); setNewSelectionPath([]); setIsCreateOpen(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm">
                    <Plus size={18} />
                    Tạo phiếu kiểm
                </button>
            </div>

            {selectedSession ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-white rounded-xl border border-stone-200 p-4">
                        <button onClick={() => { setSelectedSession(null); fetchSessions() }} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
                            <X size={20} className="text-stone-500" />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-stone-800">{selectedSession.name}</h2>
                            <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(selectedSession.created_at), 'HH:mm dd/MM/yyyy')}</span>
                                <span className="flex items-center gap-1"><User size={12} /> {selectedSession.creator_name}</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${selectedSession.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                    {selectedSession.status === 'active' ? 'Đang kiểm' : 'Hoàn thành'}
                                </span>
                                {(selectedSession.participant_names || []).length > 0 && (
                                    <>
                                        <span>•</span>
                                        <span className="flex items-center gap-1.5 bg-stone-100 px-2 py-0.5 rounded-full">
                                            <Users size={12} className="text-stone-400" />
                                            <span className="text-[10px] font-bold text-stone-600 uppercase tracking-tighter">
                                                Thành viên: {selectedSession.participant_names?.join(', ')}
                                            </span>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        {(() => {
                            const total = positions.length
                            const checked = items.filter(i => i.checked).length
                            const disc = items.filter(i => i.note).length
                            const pct = total > 0 ? Math.round((checked / total) * 100) : 0
                            return (
                                <div className="flex items-center gap-6 text-center">
                                    <div><div className="text-2xl font-black text-purple-600">{pct}%</div><div className="text-[10px] text-stone-400 font-bold uppercase">Tiến độ</div></div>
                                    <div><div className="text-lg font-black text-stone-800">{checked}/{total}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Vị trí</div></div>
                                    {disc > 0 && <div><div className="text-lg font-black text-red-600">{disc}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Sai lệch</div></div>}
                                </div>
                            )
                        })()}
                    </div>

                    {/* Debug Info */}
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-[10px] font-mono text-stone-400 flex flex-wrap gap-4">
                        <span>Phiếu: {selectedSession.id}</span>
                        <span>Kho đích: {selectedSession.warehouse_id || 'Không có'}</span>
                        <span>SelectedWh: {selectedWh || 'N/A'}</span>
                        <span>Zones: {zones.length}</span>
                        <span>WhTabs: {warehouses.length}</span>
                        <span>BuildingChildren: {buildingChildren.length}</span>
                        <span>Positions: {positions.length} ({groupedData.positions.length} sau gom)</span>
                        <span>Items: {items.length}</span>
                    </div>
                    {detailLoading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" size={32} /></div> : (
                        <>
                            <div className="flex gap-2 flex-wrap">
                                {warehouses.map(w => (
                                    <button key={w.id} onClick={() => { setSelectedWh(w.id); setExpandedZones(new Set()) }} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedWh === w.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                                        {w.name}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {buildingChildren.map(zone => {
                                    const s = getZoneStats(zone.id)
                                    return (
                                        <button key={zone.id} onClick={() => setExpandedZones(prev => new Set(prev).add(zone.id))} className="p-4 rounded-xl border border-stone-200 bg-white hover:shadow-md transition-all text-left group">
                                            <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-stone-800">{zone.name}</h3><span className={`text-sm font-black ${s.pct === 100 ? 'text-green-600' : 'text-purple-600'}`}>{s.pct}%</span></div>
                                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                                <div><div className="text-lg font-black text-stone-800">{s.total}</div><div className="text-stone-400 font-bold uppercase">Tổng</div></div>
                                                <div><div className="text-lg font-black text-green-600">{s.checked}</div><div className="text-stone-400 font-bold uppercase">Đã kiểm</div></div>
                                                <div><div className={`text-lg font-black ${s.discrepancy > 0 ? 'text-red-600' : 'text-stone-300'}`}>{s.discrepancy}</div><div className="text-stone-400 font-bold uppercase">Sai lệch</div></div>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                                    <div className="flex items-center gap-4">
                                        <h3 className="text-xs font-black text-stone-500 uppercase tracking-widest">Chi tiết vị trí</h3>
                                        <div className="flex bg-stone-100/50 p-1 rounded-xl border border-stone-200 gap-1">
                                            <button
                                                onClick={expandLevel1}
                                                className="px-3 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-white hover:text-purple-600 rounded-lg transition-all flex items-center gap-1.5"
                                                title="Mở rộng Dãy"
                                            >
                                                <ChevronDown size={12} /> Cấp 1 (Dãy)
                                            </button>
                                            <button
                                                onClick={expandLevel2}
                                                className="px-3 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-white hover:text-blue-600 rounded-lg transition-all flex items-center gap-1.5"
                                                title="Mở rộng Vị trí"
                                            >
                                                <ChevronDown size={12} /> Cấp 2 (Vị trí)
                                            </button>
                                            <div className="w-px h-4 bg-stone-200 my-auto mx-1" />
                                            <button
                                                onClick={collapseAll}
                                                className="px-3 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-white hover:text-stone-900 rounded-lg transition-all flex items-center gap-1.5"
                                                title="Thu gọn hết"
                                            >
                                                <ChevronUp size={12} /> Thu gọn
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setIsGroupingEnabled(!isGroupingEnabled)}
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isGroupingEnabled ? 'bg-purple-600 text-white' : 'bg-white border border-stone-200 text-stone-500'}`}
                                        >
                                            <LayoutGrid size={14} /> {isGroupingEnabled ? 'Đã gom ô' : 'Gom ô (Merge)'}
                                        </button>
                                    </div>
                                    {zones.find(z => z.id === selectedWh)?.is_hall && (
                                        <button onClick={() => setShowHallSummary(!showHallSummary)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showHallSummary ? 'bg-orange-500 text-white' : 'bg-white border border-stone-200 text-stone-500'}`}>
                                            <BarChart3 size={14} /> {showHallSummary ? 'Xem bản đồ' : 'Thống kê Sảnh'}
                                        </button>
                                    )}
                                </div>
                                <div className="p-4 min-h-[100px]">
                                    {showHallSummary ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {hallSummary.map((group, idx) => (
                                                <div key={idx} className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm border-l-4 border-l-stone-900">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex-1"><h4 className="font-black text-stone-900">{group.sku}</h4><p className="text-[10px] text-stone-400 font-bold uppercase">{group.name}</p></div>
                                                        <div className="text-right"><div className="text-lg font-black text-orange-600">{group.quantity} {group.unit}</div></div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 py-2 border-t border-stone-50 text-[10px]">
                                                        <div><div className="font-black">{group.count}</div><div className="text-stone-400 uppercase">Tổng Lot</div></div>
                                                        <div><div className="font-black text-green-600">{group.checkedCount}</div><div className="text-stone-400 uppercase">Đã kiểm</div></div>
                                                        <div><div className={`font-black ${group.notes.length > 0 ? 'text-red-500' : 'text-stone-300'}`}>{group.notes.length}</div><div className="text-stone-400 uppercase">Ghi chú</div></div>
                                                    </div>
                                                    {group.notes.length > 0 && <div className="mt-2 pt-2 border-t border-stone-50 text-[9px] text-stone-500 italic">{group.notes[0]}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    ) : buildingChildren.length > 0 ? (
                                        buildingChildren.map(zone => {
                                            const warehouse = sortedZones.find(z => z.id === selectedWh)
                                            return renderZoneTree(zone.id, 0, warehouse ? [warehouse.name] : [])
                                        })
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-stone-400 font-bold">Không có khu vực nào để hiển thị trong kho này.</p>
                                            <div className="text-[10px] text-stone-300 mt-2">
                                                ID Kho: {selectedWh || 'N/A'} • Zones: {zones.length} • Positions: {positions.length}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" size={32} /></div> : sessions.length === 0 ? (
                    <div className="text-center py-20 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        <ClipboardCheck size={48} className="mx-auto text-stone-300 mb-4" />
                        <p className="text-stone-500 font-bold">Chưa có phiếu kiểm kê nội bộ nào</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {sessions.map(session => {
                            const s = session.stats || { total: 0, checked: 0, discrepancy: 0 }
                            const pct = s.total > 0 ? Math.round((s.checked / s.total) * 100) : 0
                            return (
                                <div key={session.id} onClick={() => loadDetail(session)} className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex flex-col md:flex-row md:items-center gap-4 group">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0"><ClipboardCheck size={24} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="font-bold text-stone-800">{session.name}</h3>
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-100 text-blue-800">{session.status === 'active' ? 'Đang kiểm' : 'Hoàn thành'}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400 font-medium">
                                            <span className="font-bold text-stone-600">Khu vực: {session.warehouse_path}</span>
                                            <span>•</span>
                                            <span>{format(new Date(session.created_at), 'dd/MM/yyyy')}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1.5">
                                                <User size={12} className="text-stone-300" />
                                                <span className="font-bold text-stone-500">{session.creator_name}</span>
                                                {session.participant_names && session.participant_names.length > 0 && (
                                                    <span className="text-stone-300 flex items-center gap-1.5">
                                                        <span className="text-[10px] font-normal italic">cùng với</span>
                                                        <span className="flex gap-1">
                                                            {session.participant_names.join(', ')}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-center px-3 border-r border-stone-100">
                                            <div className="text-lg font-black text-stone-800">{s.checked}/{s.total}</div>
                                            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Tiến độ</div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }} className="p-2 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {isCreateOpen && (
                <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-stone-800">Tạo phiếu kiểm kê</h2>
                            <button onClick={() => setIsCreateOpen(false)} className="p-2 rounded-xl hover:bg-stone-50"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Tên phiếu kiểm..." className="w-full px-4 py-3 rounded-2xl bg-stone-50 border-2 border-transparent focus:border-purple-500 outline-none transition-all font-bold" />
                            {zonesLoading ? (
                                <div className="flex items-center gap-2 text-stone-400 py-3 px-4 bg-stone-50 rounded-2xl animate-pulse">
                                    <Loader2 size={16} className="animate-spin" />
                                    <span className="text-sm font-bold">Đang tải danh sách kho...</span>
                                </div>
                            ) : (() => {
                                const paths = [null, ...newSelectionPath]
                                const renderedDropdowns = paths.map((parentId, idx) => {
                                    const available = allZonesForCreate.filter(z => {
                                        const isRoot = !z.parent_id || z.parent_id === '';
                                        if (parentId === null) return isRoot;
                                        return z.parent_id === parentId;
                                    })

                                    if (available.length === 0) return null
                                    return (
                                        <select key={idx} value={newSelectionPath[idx] || ''} onChange={e => {
                                            const val = e.target.value
                                            const next = newSelectionPath.slice(0, idx)
                                            if (val) next.push(val)
                                            setNewSelectionPath(next)
                                        }} className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-stone-100 focus:border-purple-500 outline-none font-bold shadow-sm transition-all focus:ring-4 focus:ring-purple-50">
                                            <option value="">{idx === 0 ? '-- Chọn kho --' : '-- Tất cả khu vực con --'}</option>
                                            {available.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                                        </select>
                                    )
                                }).filter(Boolean)

                                if (allZonesForCreate.length === 0) {
                                    return (
                                        <div className="text-xs text-stone-400 font-bold px-4 space-y-1">
                                            <div>Không có dữ liệu cấu trúc kho.</div>
                                            <div className="text-[10px] opacity-40">System: {systemType} • Profile: {profile?.company_id ? 'OK' : 'Empty'}</div>
                                        </div>
                                    )
                                }

                                return (
                                    <div className="space-y-4">
                                        {renderedDropdowns}
                                        {renderedDropdowns.length === 0 && allZonesForCreate.length > 0 && (
                                            <div className="text-xs text-red-500 font-bold px-4">Không tìm thấy kho nào phù hợp.</div>
                                        )}

                                        {/* Thành viên tham gia */}
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between px-1">
                                                <h3 className="text-xs font-black text-stone-500 uppercase tracking-widest">Thành viên tham gia</h3>
                                                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{selectedUserIds.length} đã chọn</span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 p-4 rounded-2xl bg-stone-50 border-2 border-transparent max-h-[200px] overflow-y-auto">
                                                {allUsers.map(u => {
                                                    const isSelected = selectedUserIds.includes(u.id)
                                                    return (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            onClick={() => {
                                                                if (isSelected) setSelectedUserIds(prev => prev.filter(id => id !== u.id))
                                                                else setSelectedUserIds(prev => [...prev, u.id])
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 ${isSelected ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-200' : 'bg-white border-stone-100 text-stone-600 hover:border-stone-200'}`}
                                                        >
                                                            {u.full_name}
                                                        </button>
                                                    )
                                                })}
                                                {allUsers.length === 0 && <span className="text-[10px] text-stone-400 italic">Không có danh sách nhân viên</span>}
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-stone-300 px-4 font-bold italic">Đã tải {allZonesForCreate.length} khu vực</div>
                                    </div>
                                )
                            })()}
                        </div>
                        <div className="p-6 bg-stone-50 flex gap-3">
                            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-3 font-bold text-stone-600 rounded-2xl hover:bg-stone-100 transition-all">Hủy</button>
                            <button onClick={handleCreate} disabled={creating} className="flex-1 py-3 bg-purple-600 text-white font-black rounded-2xl hover:bg-purple-700 shadow-lg disabled:opacity-50 transition-all">Tạo</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
