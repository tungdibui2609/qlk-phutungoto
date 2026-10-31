'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ClipboardCheck, Plus, Loader2, ChevronRight, ChevronDown, ChevronUp, Layers, Check, Trash2, X, Calendar, User, Users, BarChart3, CheckCircle2, LayoutGrid, Eye, Package, MessageSquare, Lock, Unlock, AlertTriangle, Edit, ShieldCheck, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { format } from 'date-fns'
import { LotForm } from '@/app/(dashboard)/warehouses/lots/_components/LotForm'
import { Lot, Product, Supplier, QCInfo, Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { normalizeSearchString } from '@/lib/searchUtils'
import { canonicalizeUnit } from '@/lib/unitConversion'
import { decodeSTT } from '@/lib/numberUtils'

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
    stats?: { total: number; checked: number; discrepancy: number; modified: number; resolved: number }
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
    is_modified?: boolean
    resolved?: boolean
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
    // Supabase allows multiple .order() calls, which are applied in sequence.
    let stableQuery = query
    
    // Check if the query likely lacks an order by looking at its internal state if possible,
    // but in most cases, adding order('id') at the end ensures stability.
    stableQuery = stableQuery.order('id', { ascending: true })

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

/**
 * Fetch data in chunks using .in('id', ids) to avoid large URL issues 
 * and bypass Supabase's 1000-row limit by fetching each chunk fully.
 */
async function fetchInChunks(table: string, field: string, values: string[], select = '*', chunkSize = 60) {
    if (!values.length) return [];
    let allResults: any[] = [];
    
    for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from(table as any)
            .select(select)
            .in(field, chunk);
            
        if (error) throw error;
        if (data) allResults = [...allResults, ...data];
    }
    return allResults;
}

export default function InternalInventoryPage() {
    const { systemType, currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()
    const { hasModule } = useSystem()

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

    // Lot Edit State
    const [editingLot, setEditingLot] = useState<Lot | null>(null)
    const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
    const [dismissedNotePos, setDismissedNotePos] = useState<string | null>(null)
    const [refreshingPosId, setRefreshingPosId] = useState<string | null>(null)
    const [showLotEdit, setShowLotEdit] = useState(false)

    // Common Data for LotForm
    const [commonData, setCommonData] = useState<{
        products: Product[],
        suppliers: Supplier[],
        qcList: QCInfo[],
        units: Unit[],
        productUnits: ProductUnit[],
        branches: any[],
        existingTags: string[]
    }>({
        products: [],
        suppliers: [],
        qcList: [],
        units: [],
        productUnits: [],
        branches: [],
        existingTags: []
    })

    // Filter & Expansion
    const [selectedWh, setSelectedWh] = useState<string | null>(null)
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

    // ======== FETCH SESSIONS ========
    const fetchSessions = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            const [sessionsRes, rawZones, rawSysPos, rawZP] = await Promise.all([
                fetchAll((supabase as any).from('internal_inventory_sessions').select('*').eq('system_code', systemType).order('created_at', { ascending: false })),
                fetchAll(supabase.from('zones').select('id, name, parent_id, display_order, is_hall').eq('system_type', systemType)),
                fetchAll(supabase.from('positions').select('id, system_type, lot_id').eq('system_type', systemType)),
                fetchAll(supabase.from('zone_positions').select('zone_id, position_id'))
            ])

            if (!sessionsRes) throw new Error('Cannot fetch sessions')
            const data = sessionsRes
            




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
            let statsMap: Record<string, { total: number; checked: number; discrepancy: number; modified: number; resolved: number }> = {}

            if (sessionIds.length > 0) {
                const allItems = await fetchAll((supabase as any).from('internal_inventory_items').select('session_id, checked, note, is_modified, resolved').in('session_id', sessionIds))

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
                    statsMap[s.id] = { total, checked: 0, discrepancy: 0, modified: 0, resolved: 0 }
                })

                allItems?.forEach((item: any) => {
                    if (statsMap[item.session_id]) {
                        if (item.checked) statsMap[item.session_id].checked++
                        if (item.note && !item.resolved) statsMap[item.session_id].discrepancy++
                        if (item.note && item.resolved) statsMap[item.session_id].resolved++
                        if (item.is_modified) statsMap[item.session_id].modified++
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
                    stats: statsMap[s.id] || { total: 0, checked: 0, discrepancy: 0, modified: 0, resolved: 0 }
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
                    .eq('system_type', systemType)

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

    // Load Common Data for LotForm
    useEffect(() => {
        if (!systemType || !currentSystem) return

        const fetchCommonData = async () => {
            const fetchAllPaginated = async (table: string, filter?: (query: any) => any, selectFields = '*', pageSize = 1000) => {
                let allData: any[] = []
                let from = 0
                while (true) {
                let query = supabase.from(table as any).select(selectFields).range(from, from + pageSize - 1)
                if (filter) query = filter(query)
                // Ensure stable sorting
                query = query.order('id', { ascending: true })
                    const { data, error } = await query
                    if (error) { 
                        console.error(`[fetchAllPaginated] Error fetching ${table}:`, error); 
                        if (error.message) console.error(`[fetchAllPaginated] Error message: ${error.message}`);
                        break 
                    }
                    if (!data || data.length === 0) break
                    allData = [...allData, ...data]
                    if (data.length < pageSize) break
                    from += pageSize
                }
                return allData
            }

            try {
                const [prodData, suppData, qcData, branchData, unitData, pUnitData, tagData] = await Promise.all([
                    fetchAllPaginated('products', q => q.eq('system_type', systemType).order('name')),
                    fetchAllPaginated('suppliers', q => q.eq('system_code', systemType).order('name')),
                    fetchAllPaginated('qc_info', q => q.eq('system_code', systemType).order('name')),
                    fetchAllPaginated('branches', q => q.order('is_default', { ascending: false }).order('name')),
                    fetchAllPaginated('units'),
                    fetchAllPaginated('product_units'),
                    fetchAllPaginated('lot_tags', q => q.order('tag'), 'tag')
                ])

                const uniqueTags = Array.from(new Set(tagData.map((t: any) => t.tag))).filter(Boolean) as string[]

                setCommonData({
                    products: prodData,
                    suppliers: suppData,
                    qcList: qcData,
                    branches: branchData,
                    units: unitData,
                    productUnits: pUnitData,
                    existingTags: uniqueTags
                })
            } catch (err) {
                console.error('Error loading lot common data:', err)
            }
        }

        fetchCommonData()
    }, [systemType, currentSystem])

    const handleCreate = async () => {
        if (!systemType || !profile) return
        setCreating(true)
        const lastSelectionId = newSelectionPath.length > 0 ? newSelectionPath[newSelectionPath.length - 1] : null
        const isVirtual = lastSelectionId?.startsWith('v-')

        try {
            const { data, error } = await (supabase as any)
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
            const { error } = await (supabase as any).from('internal_inventory_sessions').delete().eq('id', id)
            if (error) throw error
            showToast('Đã xóa phiếu kiểm', 'success')
            if (selectedSession?.id === id) setSelectedSession(null)
            fetchSessions()
        } catch (e: any) {
            showToast('Lỗi xóa: ' + e.message, 'error')
        }
    }

    const loadDetail = useCallback(async (session: Session, silent = false) => {
        if (!systemType) return
        if (!silent) setDetailLoading(true)
        setSelectedSession(session)
        try {
            let virtualWhId: string | null = null
            try {
                if (session.note && session.note.startsWith('{')) {
                    const parsed = JSON.parse(session.note)
                    virtualWhId = parsed.v || null
                }
            } catch (e) { }

            const [rawZonesData, rawPosData, itemsData, zpData] = await Promise.all([
                fetchAll(supabase.from('zones').select('id, name, code, parent_id, level, display_order, is_hall, system_type').eq('system_type', systemType)),
                fetchAll(supabase.from('positions').select('id, code, lot_id, system_type').eq('system_type', systemType)),
                fetchAll((supabase as any).from('internal_inventory_items').select('*').eq('session_id', session.id)),
                fetchAll(supabase.from('zone_positions').select('zone_id, position_id')),
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
                // IMPORTANT: Fetch lots in chunks to bypass 1000-row limit
                const lots = await fetchInChunks(
                    'lots', 
                    'id', 
                    lotIds, 
                    'id, code, daily_seq, lot_items(id, quantity, unit, products(name, sku, color)), lot_tags(tag)'
                )

                const infoMap: Record<string, any> = {}
                lots?.forEach((l: any) => {
                    infoMap[l.id] = {
                        code: l.code,
                        stt: decodeSTT(l.daily_seq),
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
    }, [systemType, showToast, profile?.company_id, lotInfo])

    const handleEditLot = (lotId: string, positionId: string) => {
        setEditingPositionId(positionId)
        setDismissedNotePos(null)
        // Fetch full lot details if needed, or construct from lotInfo
        const loadFullLot = async () => {
            const { data, error } = await (supabase as any)
                .from('lots')
                .select(`
                    *,
                    lot_items(id, quantity, product_id, unit, products(name, sku, unit, internal_code, internal_name)),
                    lot_tags(tag, lot_item_id)
                `)
                .eq('id', lotId)
                .single()

            if (data) {
                setEditingLot(data as any as Lot)
                setShowLotEdit(true)
            } else if (error) {
                showToast('Lỗi tải thông tin lô: ' + error.message, 'error')
            }
        }
        loadFullLot()
    }

    const handleCreateLotAtPosition = (positionId: string) => {
        setEditingPositionId(positionId)
        setDismissedNotePos(null)
        setEditingLot(null)
        setShowLotEdit(true)
    }

    const onLotEditSuccess = async (updatedLot: any) => {
        if (!selectedSession || !profile) return
        const posId = editingPositionId
        setShowLotEdit(false)
        setEditingLot(null)
        setEditingPositionId(null)

        showToast('Đang cập nhật dữ liệu...', 'info')

        // Find which position was affected
        const affectedPosId = posId || positions.find(p => p.lot_id === updatedLot.id)?.id
        if (!affectedPosId) return

        try {
            const existing = items.find(i => i.position_id === affectedPosId)
            const pos = positions.find(p => p.id === affectedPosId)

            // Vị trí trống được tạo LOT mới từ bút → gán lot vào vị trí và tự tích kiểm
            const isNewAssignment = !pos?.lot_id && !!updatedLot?.id
            if (isNewAssignment) {
                const { error: linkErr } = await (supabase as any)
                    .from('positions')
                    .update({ lot_id: updatedLot.id })
                    .eq('id', affectedPosId)
                if (linkErr) {
                    showToast('Lỗi gán LOT vào vị trí: ' + linkErr.message, 'error')
                    return
                }
            }

            const { data, error } = await (supabase as any).from('internal_inventory_items' as any).upsert({
                session_id: selectedSession.id,
                position_id: affectedPosId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
                checked: existing?.checked || isNewAssignment,
                note: existing?.note || null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: updatedLot?.id || pos?.lot_id || null,
                is_modified: true
            }, { onConflict: 'session_id,position_id' })

            if (error) {
                showToast('Lỗi cập nhật trạng thái: ' + error.message, 'error')
                return
            }

            console.log('Upsert success, record:', data)

            // Refresh detailed data silently to preserve UX
            loadDetail(selectedSession, true)
            showToast(isNewAssignment ? 'Đã tạo LOT, gán vào vị trí và đánh dấu đã kiểm' : 'Đã cập nhật thông tin LOT thành công', 'success')
        } catch (e: any) {
            console.error('Catch error:', e)
            showToast('Lỗi cập nhật trạng thái: ' + e.message, 'error')
        }
    }

    const toggleCheck = async (positionId: string) => {
        if (!selectedSession || !profile) return
        if (selectedSession.status === 'completed') {
            showToast('Phiếu đã được khóa, không thể chỉnh sửa', 'warning')
            return
        }
        const existing = items.find(i => i.position_id === positionId)
        const newChecked = !existing?.checked

        setItems(prev => {
            if (existing) return prev.map(i => i.position_id === positionId ? { ...i, checked: newChecked, checked_at: new Date().toISOString() } : i)
            const pos = positions.find(p => p.id === positionId)
            return [...prev, {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
                checked: true,
                note: null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null
            }]
        })

        try {
            const pos = positions.find(p => p.id === positionId)
            await (supabase as any).from('internal_inventory_items').upsert({
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
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
        if (selectedSession.status === 'completed') {
            showToast('Phiếu đã được khóa, không thể chỉnh sửa', 'warning')
            return
        }
        const existing = items.find(i => i.position_id === positionId)
        // Sửa/xóa ghi chú coi như phát sinh lại sai lệch -> phải xác nhận xử lý lại
        const newResolved = note !== (existing?.note || '') ? false : (existing?.resolved || false)

        setItems(prev => {
            if (existing) return prev.map(i => i.position_id === positionId ? { ...i, note, resolved: newResolved } : i)
            const pos = positions.find(p => p.id === positionId)
            return [...prev, {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
                checked: false,
                note,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null
            }]
        })

        try {
            const pos = positions.find(p => p.id === positionId)
            await (supabase as any).from('internal_inventory_items').upsert({
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
                checked: existing?.checked || false,
                note,
                resolved: newResolved,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null,
            }, { onConflict: 'session_id,position_id' })
        } catch (e) {
            console.error('Note update error:', e)
        }
    }

    const toggleResolved = async (positionId: string, resolved: boolean) => {
        if (!selectedSession || !profile) return
        if (selectedSession.status === 'completed') {
            showToast('Phiếu đã được khóa, không thể chỉnh sửa', 'warning')
            return
        }
        const existing = items.find(i => i.position_id === positionId)
        setItems(prev => prev.map(i => i.position_id === positionId ? { ...i, resolved } : i))

        try {
            const pos = positions.find(p => p.id === positionId)
            await (supabase as any).from('internal_inventory_items').upsert({
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
                checked: existing?.checked || false,
                note: existing?.note || null,
                resolved,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: pos?.lot_id || null,
            }, { onConflict: 'session_id,position_id' })
        } catch (e) {
            console.error('Resolve toggle error:', e)
        }
    }

    const bulkCheck = async (pids: string[], checked: boolean) => {
        if (!selectedSession || !profile || pids.length === 0) return
        if (selectedSession.status === 'completed') {
            showToast('Phiếu đã được khóa, không thể chỉnh sửa', 'warning')
            return
        }
        const upserts = pids.map(pid => {
            const pos = positions.find(p => p.id === pid)
            const existing = items.find(i => i.position_id === pid)
            return {
                session_id: selectedSession.id,
                position_id: pid,
                zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
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
                        zone_id: (pos?.zone_id && !pos.zone_id.startsWith('v-')) ? pos.zone_id : null,
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
            await (supabase as any).from('internal_inventory_items').upsert(upserts, { onConflict: 'session_id,position_id' })
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

    const toggleSessionStatus = async () => {
        if (!selectedSession) return
        const isLocked = selectedSession.status === 'completed'
        const newStatus = isLocked ? 'active' : 'completed'

        try {
            const { error } = await (supabase as any)
                .from('internal_inventory_sessions')
                .update({
                    status: newStatus,
                    completed_at: newStatus === 'completed' ? new Date().toISOString() : null
                })
                .eq('id', selectedSession.id)

            if (error) throw error

            const updatedSession = {
                ...selectedSession,
                status: newStatus,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : null
            }
            setSelectedSession(updatedSession)
            setSessions(prev => prev.map(s => s.id === selectedSession.id ? updatedSession : s))
            showToast(newStatus === 'completed' ? 'Đã khóa kiểm kê thành công' : ' Đã mở lại kiểm kê', 'success')
        } catch (e: any) {
            showToast('Lỗi cập nhật trạng thái: ' + e.message, 'error')
        }
    }

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
        // Sai lệch = còn ghi chú CHƯA được bấm "Đã xử lý" (tích V tiến độ không ảnh hưởng)
        const discrepancy = zonePos.filter(p => itemsMap[p.id]?.note && !itemsMap[p.id]?.resolved).length
        const resolved = zonePos.filter(p => itemsMap[p.id]?.note && itemsMap[p.id]?.resolved).length
        const modified = zonePos.filter(p => itemsMap[p.id]?.is_modified).length
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0
        return { total, occupied, checked, discrepancy, resolved, modified, pct }
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

    const hasHallInScope = useMemo(() => {
        if (!selectedWh) return false
        const ids = effectiveWhId ? getDescendantIds(effectiveWhId) : getDescendantIds(selectedWh)
        return sortedZones.some(z => ids.includes(z.id) && z.is_hall)
    }, [selectedWh, effectiveWhId, getDescendantIds, sortedZones])

    const hallSummary = useMemo(() => {
        if (!hasHallInScope || !selectedWh) return []
        const groups: Record<string, any> = {}
        const scopeIds = effectiveWhId ? getDescendantIds(effectiveWhId) : getDescendantIds(selectedWh)
        const hallZoneIds = sortedZones.filter(z => scopeIds.includes(z.id) && z.is_hall).map(z => z.id)

        // Target positions are those inside any identified hall zone
        const targetZoneIds = hallZoneIds.flatMap(hzid => getDescendantIds(hzid))
        const dPositions = groupedData.positions.filter(p => p.zone_id && targetZoneIds.includes(p.zone_id))

        dPositions.forEach((p: any) => {
            const lot = p.lot_id ? lotInfo[p.lot_id] : null
            if (!lot || !lot.items) return
            lot.items.forEach((it: any) => {
                const tag = lot.tags?.[0] || ''
                const groupKey = `${canonicalizeUnit(it.sku)}|${it.quantity}|${canonicalizeUnit(it.unit)}|${tag}`;
                const res = itemsMap[p.id] || { checked: false, note: null }
                if (!groups[groupKey]) {
                    groups[groupKey] = {
                        groupKey,
                        sku: it.sku,
                        name: it.product_name,
                        quantity: it.quantity,
                        unit: it.unit,
                        tag,
                        count: 1,
                        positionIds: [p.id],
                        checkedCount: res.checked ? 1 : 0,
                        notes: res.note ? [res.note] : []
                    }
                } else {
                    groups[groupKey].count++
                    groups[groupKey].positionIds.push(p.id)
                    if (res.checked) groups[groupKey].checkedCount++
                    if (res.note) groups[groupKey].notes.push(res.note)
                }
            })
        })
        return Object.values(groups).sort((a: any, b: any) => a.sku.localeCompare(b.sku))
    }, [selectedWh, sortedZones, groupedData.positions, lotInfo, itemsMap, getDescendantIds, effectiveWhId])

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

    const copyQuick = async (text: string, label: string) => {        if (!text) return
        try {
            await navigator.clipboard.writeText(text)
            showToast(`Đã copy ${label}: ${text}`, 'success')
        } catch (e) {
            console.error('Copy error:', e)
            showToast('Không thể copy', 'error')
        }
    }

    const refreshPositionLot = async (pos: any) => {
        if (refreshingPosId) return
        setRefreshingPosId(pos.id)
        try {
            const { data: fresh, error } = await (supabase as any)
                .from('positions')
                .select('id, code, lot_id')
                .eq('id', pos.id)
                .single()
            if (error || !fresh) {
                showToast('Không tải được dữ liệu ô này' + (error ? `: ${error.message}` : ''), 'error')
                return
            }
            setPositions(prev => prev.map(p => p.id === fresh.id ? { ...p, ...fresh } : p))

            if (fresh.lot_id) {
                const { data: lot } = await (supabase as any)
                    .from('lots')
                    .select('id, code, daily_seq, lot_items(id, quantity, unit, products(name, sku, color)), lot_tags(tag)')
                    .eq('id', fresh.lot_id)
                    .single()
                if (lot) {
                    setLotInfo(prev => ({
                        ...prev,
                        [lot.id]: {
                            code: lot.code,
                            stt: decodeSTT(lot.daily_seq),
                            tags: lot.lot_tags?.map((t: any) => t.tag) || [],
                            items: lot.lot_items?.map((li: any) => ({
                                product_name: li.products?.name,
                                sku: li.products?.sku,
                                product_color: li.products?.color,
                                quantity: li.quantity,
                                unit: li.unit || li.products?.unit,
                            })) || []
                        }
                    }))
                }
            }
            showToast(`Đã tải lại ô ${fresh.code}`, 'success')
        } catch (e: any) {
            showToast('Lỗi tải lại ô: ' + e.message, 'error')
        } finally {
            setRefreshingPosId(null)
        }
    }

    const renderInventoryPosition = (pos: any, isHall: boolean = false) => {
        const item = itemsMap[pos.id]
        const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
        const isChecked = item?.checked
        const hasNote = !!item?.note
        const isResolved = !!item?.resolved
        const isDiscrepancy = hasNote && !isResolved
        const isModified = !!item?.is_modified
        const locked = selectedSession?.status === 'completed'

        const tone = locked
            ? 'bg-stone-50 border-stone-200 opacity-70'
            : isDiscrepancy
                ? 'bg-red-50/70 border-red-300'
                : isChecked
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : isModified
                        ? 'bg-blue-50/70 border-blue-300'
                        : 'bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm'

        const dotColor = isDiscrepancy ? 'bg-red-500' : isChecked ? 'bg-emerald-500' : isModified ? 'bg-blue-500' : 'bg-stone-200'

        return (
            <div
                key={pos.id}
                onClick={() => toggleCheck(pos.id)}
                title={isHall ? 'Nhấn để tích kiểm tra' : undefined}
                className={`group/pos relative overflow-hidden rounded-lg border px-2.5 py-1.5 cursor-pointer transition-all min-w-0 ${tone} ${locked ? 'pointer-events-none' : ''}`}
            >
                {/* Dòng 1: trạng thái | mã vị trí | STT | mã LOT | hành động */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span
                        onClick={(e) => { e.stopPropagation(); copyQuick(pos.code, 'Mã vị trí') }}
                        className="text-[11px] font-bold text-stone-800 tracking-tight whitespace-nowrap shrink-0 cursor-copy hover:text-blue-600 hover:underline decoration-dotted underline-offset-2"
                        title="Bấm để copy mã vị trí"
                    >{pos.code}</span>
                    {lot?.stt && (
                        <span
                            className="shrink-0 px-1 rounded bg-amber-100/80 text-amber-700 text-[9px] font-bold tabular-nums leading-tight"
                            title={`STT LOT: ${lot.stt}`}
                        >{lot.stt}</span>
                    )}
                    {lot && (
                        <span
                            onClick={(e) => { e.stopPropagation(); copyQuick(lot.code, 'Mã LOT') }}
                            className="text-[10px] font-semibold text-amber-600 truncate min-w-0 flex-1 cursor-copy hover:text-blue-600 hover:underline decoration-dotted underline-offset-2"
                            title={`${lot.code} — bấm để copy mã LOT`}
                        >{lot.code}</span>
                    )}
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                        {isModified && <span className="text-[8px] font-bold text-blue-600 uppercase tracking-tight">Đã sửa</span>}
                        {hasNote && (
                            isResolved ? (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleResolved(pos.id, false) }}
                                    className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-all"
                                    title="Đã xác nhận xử lý — bấm để bỏ xác nhận"
                                >
                                    <ShieldCheck size={12} />
                                    <span className="text-[8px] font-bold uppercase tracking-tight">Đã xử lý</span>
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleResolved(pos.id, true) }}
                                    className="p-0.5 rounded text-red-400 hover:text-white hover:bg-emerald-500 transition-all"
                                    title="Xác nhận đã xử lý sai lệch (sau khi đã gán lại vị trí trong Quản lý LOT)"
                                >
                                    <ShieldCheck size={14} />
                                </button>
                            )
                        )}
                        {isChecked && <CheckCircle2 size={13} className="text-emerald-500" />}
                        {!locked && (
                            <button
                                onClick={(e) => { e.stopPropagation(); refreshPositionLot(pos) }}
                                className="p-0.5 rounded text-stone-300 hover:text-emerald-600 hover:bg-emerald-100/60 transition-all"
                                title="Tải lại dữ liệu ô này từ máy chủ"
                            >
                                <RefreshCw size={12} className={refreshingPosId === pos.id ? 'animate-spin' : ''} />
                            </button>
                        )}
                        {!locked && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    if (lot) handleEditLot(pos.lot_id, pos.id)
                                    else handleCreateLotAtPosition(pos.id)
                                }}
                                className="p-0.5 rounded text-stone-300 hover:text-blue-600 hover:bg-blue-100/60 transition-all"
                                title={lot ? 'Sửa LOT' : 'Tạo LOT cho vị trí này'}
                            >
                                <Edit size={12} />
                            </button>
                        )}
                    </span>
                </div>

                {/* Dòng 2+: sản phẩm (hiện đầy đủ, tự xuống dòng) | số lượng ở dòng dưới */}
                {lot ? (
                    <div className="mt-0.5 pl-3 space-y-1">
                        {lot.items?.map((li: any, i: number) => (
                            <div key={i} className="min-w-0" title={`${li.sku} — ${li.product_name || ''}`}>
                                <p className="text-[11px] leading-tight text-stone-700 break-words">{li.product_name || li.sku}</p>
                                <div className="flex items-baseline justify-between gap-2 min-w-0">
                                    <p className="text-[9px] leading-tight text-stone-400 font-mono truncate min-w-0">
                                        {li.product_name ? li.sku : ''}
                                        {(lot.tags?.length ?? 0) > 0 && <span className="ml-1 not-italic">{lot.tags.join(' / ')}</span>}
                                    </p>
                                    <p className="text-[11px] font-bold text-stone-900 tabular-nums whitespace-nowrap shrink-0">
                                        {li.quantity} <span className="text-[9px] font-semibold text-stone-400 uppercase">{li.unit}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="mt-0.5 pl-3 text-[10px] italic text-stone-300">Vị trí trống</p>
                )}

                {/* Ghi chú sai lệch: hiện khi có note hoặc hover */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    className={`mt-1 pl-3 transition-opacity ${hasNote ? '' : 'opacity-0 group-hover/pos:opacity-100'}`}
                >
                    <input
                        key={pos.id}
                        type="text"
                        defaultValue={item?.note || ''}
                        onBlur={(e) => updateNote(pos.id, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="Ghi chú sai lệch…"
                        className={`w-full min-w-0 bg-transparent text-[10px] italic outline-none border-t pt-0.5 ${hasNote ? (isDiscrepancy ? 'text-red-600 border-red-200' : 'text-emerald-600 border-emerald-200') : 'text-stone-500 border-stone-100 placeholder:text-stone-300 focus:text-stone-700'}`}
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
            const hasErr = s.discrepancy > 0
            return (
                <div key={zoneId} className="mb-4">
                    <div
                        className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition-all shadow-sm ${hasErr ? 'bg-red-50 border-red-200 hover:bg-red-100/50' : 'bg-emerald-50/50 border-emerald-100 hover:bg-emerald-100/50'}`}
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-1 h-7 rounded-full ${hasErr ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            <div className="flex items-center gap-2.5">
                                {isExpanded ? (
                                    <ChevronDown size={18} className={hasErr ? 'text-red-600' : 'text-emerald-600'} />
                                ) : (
                                    <ChevronRight size={18} className={hasErr ? 'text-red-600' : 'text-emerald-600'} />
                                )}
                                <div>
                                    <h2 className="text-sm font-bold text-stone-900 tracking-tight uppercase">{zone.name}</h2>
                                    <p className="text-[11px] font-semibold text-stone-500">{s.total} vị trí</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg border ${hasErr ? 'bg-red-100/50 border-red-200' : 'bg-white/80 border-emerald-100'}`}>
                                <span className={`text-[10px] font-bold ${hasErr ? 'text-red-600' : 'text-emerald-600'}`}>{s.checked}/{s.total}</span>
                                <div className={`w-16 h-1.5 rounded-full overflow-hidden ${hasErr ? 'bg-red-200' : 'bg-emerald-100'}`}>
                                    <div className={`h-full ${hasErr ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${s.pct}%` }} />
                                </div>
                                <span className={`text-[10px] font-bold ${hasErr ? 'text-red-600' : 'text-emerald-600'}`}>{s.pct}%</span>
                                {s.modified > 0 && <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded ml-1">{s.modified} ĐÃ SỬA</span>}
                                {s.resolved > 0 && <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.5 rounded ml-1">{s.resolved} ĐÃ XỬ LÝ</span>}
                                {hasErr && <span className="text-[9px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded ml-1">SAI LỆCH</span>}
                            </div>
                        </div>
                    </div>
                    {isExpanded && (
                        <div className={`mt-2 ${isGroupingEnabled ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3' : 'space-y-3'}`}>
                            {filteredChildren.map(child => renderZoneTree(child.id, depth + 1, isGroupingEnabled ? currentBreadcrumb : []))}
                            {hasDirectPositions && (
                                <div className={`grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2 py-2 px-1 ${zone.is_hall ? 'col-span-full' : ''}`}>
                                    {filteredPos.map(pos => (
                                        <div key={pos.id} className="w-full">
                                            {renderInventoryPosition(pos, !!zone.is_hall)}
                                        </div>
                                    ))}
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
                <div key={zoneId} className={`border rounded-xl p-3 shadow-sm hover:shadow transition-all ${hasErr ? 'bg-red-50/60 border-red-200' : 'bg-white border-stone-200'}`}>
                    <div
                        className="flex items-center justify-between mb-2 cursor-pointer"
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className={`flex items-center gap-2 ${hasErr ? 'text-red-700' : 'text-stone-900'}`}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="text-sm font-bold tracking-tight">{zone.name}</span>
                            <span className={`${hasErr ? 'bg-red-600' : 'bg-stone-400'} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-1`}>
                                {s.total} vị trí {hasErr && '• SAI LỆCH'}
                            </span>
                            {s.modified > 0 && (
                                <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {s.modified} đã sửa LOT
                                </span>
                            )}
                            {s.resolved > 0 && (
                                <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {s.resolved} đã xử lý
                                </span>
                            )}
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="space-y-3">
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
                <div key={zoneId} className={`space-y-2 p-2 rounded-lg transition-colors ${hasErr ? 'bg-red-50/40' : ''}`}>
                    <div
                        className={`flex items-center justify-between border-b pb-1.5 cursor-pointer group ${hasErr ? 'border-red-200' : 'border-stone-100'}`}
                        onClick={() => toggleExpand(zoneId)}
                    >
                        <div className="flex items-center gap-2">
                            <div className={`w-1 h-5 rounded-full ${hasErr ? 'bg-red-500' : 'bg-emerald-500'}`} />
                            <h3 className={`text-[11px] font-bold font-mono uppercase tracking-tight ${hasErr ? 'text-red-600' : 'text-stone-500'}`}>
                                {bcText} | {s.total} VỊ TRÍ {hasErr && '• CÓ SAI LỆCH'}
                            </h3>
                            {s.modified > 0 && (
                                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                                    {s.modified} đã sửa
                                </span>
                            )}
                            {s.resolved > 0 && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                                    {s.resolved} đã xử lý
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp size={14} className={hasErr ? 'text-red-400' : 'text-stone-300'} /> : <ChevronDown size={14} className={hasErr ? 'text-red-400' : 'text-stone-300'} />}
                        </div>
                    </div>
                    {isExpanded && (
                        <div className={`grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2 px-1 ${zone.is_hall ? 'col-span-full' : ''}`}>
                            {filteredPos.map(pos => (
                                <div key={pos.id} className="w-full">
                                    {renderInventoryPosition(pos, !!zone.is_hall)}
                                </div>
                            ))}
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
                        {s.modified > 0 && <span className="bg-blue-500 text-white px-2 py-0.5 rounded font-bold">{s.modified} sửa</span>}
                        {s.resolved > 0 && <span className="bg-emerald-500 text-white px-2 py-0.5 rounded font-bold">{s.resolved} xử lý</span>}
                        {s.discrepancy > 0 && <span className="bg-red-500 text-white px-2 py-0.5 rounded font-bold">{s.discrepancy} !</span>}
                        <span className={`font-bold ${s.pct === 100 ? 'text-green-600' : 'text-stone-400'}`}>{s.pct}%</span>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-1">
                        {filteredChildren.map(child => renderZoneTree(child.id, depth + 1, currentBreadcrumb))}
                        {hasDirectPositions && (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2 py-2 px-1">
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
                    {selectedSession.status === 'completed' && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 ring-2 ring-white">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-base font-bold text-amber-900 leading-tight tracking-tight mb-0.5">KIỂM KÊ ĐÃ ĐƯỢC KHÓA</h4>
                                <p className="text-[11px] font-semibold text-amber-600 leading-relaxed max-w-2xl">Toàn bộ dữ liệu phiếu này đã chốt và đồng bộ — tích chọn, ghi chú và chỉnh sửa đều bị vô hiệu hóa.</p>
                            </div>
                            <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-amber-200 text-amber-600 font-black text-xs uppercase italic">
                                Chế độ xem an toàn
                            </div>
                        </div>
                    )}

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
                            const disc = items.filter(i => i.note && !i.resolved).length
                            const done = items.filter(i => i.note && i.resolved).length
                            const mod = items.filter(i => i.is_modified).length
                            const pct = total > 0 ? Math.round((checked / total) * 100) : 0
                            return (
                                <div className="flex items-center gap-6 text-center">
                                    <div><div className="text-2xl font-black text-purple-600">{pct}%</div><div className="text-[10px] text-stone-400 font-bold uppercase">Tiến độ</div></div>
                                    <div><div className="text-lg font-black text-stone-800">{checked}/{total}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Vị trí</div></div>
                                    {mod > 0 && <div><div className="text-lg font-black text-blue-600">{mod}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Đã sửa LOT</div></div>}
                                    {done > 0 && <div><div className="text-lg font-black text-emerald-600">{done}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Đã xử lý</div></div>}
                                    {disc > 0 && <div><div className="text-lg font-black text-red-600">{disc}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Sai lệch</div></div>}

                                    <div className="h-10 w-px bg-stone-100 mx-2" />

                                    <button
                                        onClick={toggleSessionStatus}
                                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${selectedSession.status === 'completed'
                                            ? 'bg-amber-500 text-white shadow-amber-100 hover:bg-amber-600'
                                            : 'bg-stone-900 text-white shadow-stone-200 hover:bg-stone-800'
                                            }`}
                                    >
                                        {selectedSession.status === 'completed' ? (
                                            <>
                                                <Unlock size={18} />
                                                MỞ LẠI KIỂM KÊ
                                            </>
                                        ) : (
                                            <>
                                                <Lock size={18} />
                                                KHÓA KIỂM KÊ
                                            </>
                                        )}
                                    </button>
                                </div>
                            )
                        })()}
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
                                        <button key={zone.id} onClick={() => setExpandedZones(prev => new Set(prev).add(zone.id))} className="p-3 rounded-xl border border-stone-200 bg-white hover:shadow-sm transition-all text-left group">
                                            <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-bold text-stone-800">{zone.name}</h3><span className={`text-xs font-bold ${s.pct === 100 ? 'text-green-600' : 'text-purple-600'}`}>{s.pct}%</span></div>
                                            <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
                                                <div><div className="text-base font-bold text-stone-800 tabular-nums">{s.total}</div><div className="text-stone-400 font-semibold uppercase">Tổng</div></div>
                                                <div><div className="text-base font-bold text-green-600 tabular-nums">{s.checked}</div><div className="text-stone-400 font-semibold uppercase">Đã kiểm</div></div>
                                                <div><div className={`text-base font-bold tabular-nums ${s.modified > 0 ? 'text-blue-600' : 'text-stone-300'}`}>{s.modified}</div><div className="text-stone-400 font-semibold uppercase">Đã sửa</div></div>
                                                <div><div className={`text-base font-bold tabular-nums ${s.resolved > 0 ? 'text-emerald-600' : 'text-stone-300'}`}>{s.resolved}</div><div className="text-stone-400 font-semibold uppercase">Xử lý</div></div>
                                                <div><div className={`text-base font-bold tabular-nums ${s.discrepancy > 0 ? 'text-red-600' : 'text-stone-300'}`}>{s.discrepancy}</div><div className="text-stone-400 font-semibold uppercase">Sai lệch</div></div>
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
                                    {hasHallInScope && (
                                        <button onClick={() => setShowHallSummary(!showHallSummary)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${showHallSummary ? 'bg-orange-500 text-white' : 'bg-white border border-stone-200 text-stone-500'}`}>
                                            <BarChart3 size={14} /> {showHallSummary ? 'Xem bản đồ' : 'Thống kê Sảnh'}
                                        </button>
                                    )}
                                </div>
                                <div className="p-4 min-h-[100px]">
                                    {showHallSummary ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5">
                                            {hallSummary.map((group, idx) => {
                                                const allChecked = group.checkedCount === group.count;
                                                const hasErr = group.notes.length > 0;
                                                const firstNote = group.notes[0] || '';
                                                return (
                                                    <div key={idx} className={`border rounded-xl p-3 shadow-sm hover:shadow-md transition-all relative group/card flex flex-col gap-2 overflow-hidden ${hasErr ? 'bg-red-50/70 border-red-200' : 'bg-white border-stone-200'}`}>
                                                        {/* Thanh trạng thái trên đầu */}
                                                        <div className={`absolute top-0 left-0 right-0 h-1 ${hasErr ? 'bg-red-500' : allChecked ? 'bg-emerald-500' : 'bg-orange-400'}`} />

                                                        {/* Header: ô tích chọn + SKU + số lượng */}
                                                        <div className="flex justify-between items-start gap-2 pt-0.5">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <button
                                                                    onClick={() => {
                                                                        bulkCheck(group.positionIds, !allChecked)
                                                                    }}
                                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${selectedSession.status === 'completed'
                                                                        ? 'bg-stone-100 text-stone-300 cursor-not-allowed pointer-events-none'
                                                                        : allChecked
                                                                            ? 'bg-emerald-500 text-white shadow-sm'
                                                                            : 'bg-white border border-stone-200 text-stone-200 hover:border-emerald-300 hover:text-emerald-400'
                                                                        }`}
                                                                >
                                                                    <CheckCircle2 size={16} />
                                                                </button>
                                                                <div className="min-w-0">
                                                                    <h4 className="text-[13px] font-bold text-stone-900 tracking-tight leading-none truncate" title={group.sku}>{group.sku}</h4>
                                                                    {group.tag && (
                                                                        <span className="block text-[9px] font-semibold text-orange-600 uppercase tracking-tight truncate mt-0.5">{group.tag}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-base font-bold text-orange-600 leading-none tabular-nums">{group.quantity}</div>
                                                                <div className="text-[9px] font-semibold text-stone-400 uppercase mt-0.5">{group.unit}</div>
                                                            </div>
                                                        </div>

                                                        {/* Tên sản phẩm */}
                                                        <div className="flex items-center gap-1.5 pl-1">
                                                            <Package size={14} className="text-stone-300 shrink-0" />
                                                            <p className="text-[11px] font-semibold text-stone-700 leading-snug line-clamp-2" title={group.name}>{group.name}</p>
                                                        </div>

                                                        {/* Thống kê cụm */}
                                                        <div className="flex items-center gap-3 text-[10px] font-semibold text-stone-400 border-t border-stone-100 pt-1.5">
                                                            <span>Tổng <span className="text-stone-700 font-bold tabular-nums">{group.count}</span></span>
                                                            <span>Đã kiểm <span className="text-emerald-600 font-bold tabular-nums">{group.checkedCount}</span></span>
                                                            <span>Ghi chú <span className={`font-bold tabular-nums ${group.notes.length > 0 ? 'text-red-500' : 'text-stone-400'}`}>{group.notes.length}</span></span>
                                                        </div>

                                                        {/* Ghi chú chung */}
                                                        <div className={`flex items-center gap-1.5 border-t pt-1.5 ${firstNote ? 'border-red-100' : 'border-stone-100'}`}>
                                                            <MessageSquare size={12} className={`shrink-0 ${firstNote ? 'text-red-500' : 'text-stone-300'}`} />
                                                            <input
                                                                type="text"
                                                                placeholder="Ghi chú chung cho cụm…"
                                                                defaultValue={firstNote}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val !== firstNote) {
                                                                        group.positionIds.forEach((pid: string) => updateNote(pid, val));
                                                                        showToast(`Đã cập nhật ghi chú cụm`, 'info');
                                                                    }
                                                                }}
                                                                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                                                className={`flex-1 min-w-0 bg-transparent text-[11px] italic outline-none placeholder:text-stone-300 ${firstNote ? 'text-red-600' : 'text-stone-500 focus:text-stone-700'}`}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
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
                            const s = session.stats || { total: 0, checked: 0, discrepancy: 0, modified: 0, resolved: 0 }
                            const pct = s.total > 0 ? Math.round((s.checked / s.total) * 100) : 0
                            return (
                                <div
                                    key={session.id}
                                    onClick={() => loadDetail(session)}
                                    className={`rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer p-4 flex flex-col md:flex-row md:items-center gap-4 group ${s.discrepancy > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.discrepancy > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-100' : 'bg-purple-50 text-purple-600'}`}>
                                        <ClipboardCheck size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <h3 className="font-bold text-stone-800">{session.name}</h3>
                                            {session.status === 'active' ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-50 text-blue-600 border border-blue-100 italic tracking-wider">Đang kiểm</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-stone-900 text-white flex items-center gap-1 shadow-sm border border-stone-800 tracking-wider">
                                                    <Lock size={10} className="text-amber-400" />
                                                    Hoàn thành
                                                </span>
                                            )}
                                            {s.discrepancy > 0 && (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-500 text-white animate-pulse">Có sai lệch</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-400 font-medium">
                                            <span className="font-bold text-stone-600">Khu vực: {session.warehouse_path}</span>
                                            <span>•</span>
                                            <span>{format(new Date(session.created_at), 'dd/MM/yyyy')}</span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1.5">
                                                <User size={12} className="text-stone-400" />
                                                <span className="font-bold text-stone-800">{session.creator_name}</span>
                                                {session.participant_names && session.participant_names.length > 0 && (
                                                    <span className="flex items-center gap-1.5">
                                                        <span className="text-[10px] font-normal italic text-stone-400">cùng với</span>
                                                        <span className="font-bold text-stone-600">
                                                            {session.participant_names.join(', ')}
                                                        </span>
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                        {s.modified > 0 && (
                                            <div className="text-center px-3 border-r border-blue-100">
                                                <div className="text-lg font-black text-blue-600">{s.modified}</div>
                                                <div className="text-[8px] font-bold text-blue-400 uppercase tracking-widest leading-none">Đã sửa</div>
                                            </div>
                                        )}
                                        {s.resolved > 0 && (
                                            <div className="text-center px-3 border-r border-emerald-100">
                                                <div className="text-lg font-black text-emerald-600">{s.resolved}</div>
                                                <div className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest leading-none">Đã xử lý</div>
                                            </div>
                                        )}
                                        {s.discrepancy > 0 && (
                                            <div className="text-center px-3 border-r border-red-100">
                                                <div className="text-lg font-black text-red-600">-{s.discrepancy}</div>
                                                <div className="text-[8px] font-bold text-red-400 uppercase tracking-widest leading-none">Sai lệch</div>
                                            </div>
                                        )}
                                        <div className="text-center px-3 border-r border-stone-100">
                                            <div className="text-lg font-black text-stone-800">{s.checked}/{s.total}</div>
                                            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-widest leading-none">Tiến độ</div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }} className="p-2 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {showLotEdit && (
                <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[60] overflow-y-auto p-4 md:p-10">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex justify-end mb-4">
                            <button onClick={() => { setShowLotEdit(false); setEditingLot(null) }} className="p-3 bg-white/20 hover:bg-white/40 text-white rounded-full transition-all">
                                <X size={24} />
                            </button>
                        </div>
                        <LotForm
                            isVisible={showLotEdit}
                            editingLot={editingLot}
                            onClose={() => { setShowLotEdit(false); setEditingLot(null); setEditingPositionId(null) }}
                            onSuccess={onLotEditSuccess}
                            autoFillStt={false}
                            collapseDetailsByDefault
                            products={commonData.products}
                            suppliers={commonData.suppliers}
                            qcList={commonData.qcList}
                            units={commonData.units}
                            productUnits={commonData.productUnits}
                            branches={commonData.branches}
                            existingTags={commonData.existingTags}
                        />
                    </div>
                </div>
            )}

            {/* Bong bóng nổi ghi chú kiểm kê — luôn giữa màn hình khi cuộn trong modal LOT */}
            {showLotEdit && editingPositionId && itemsMap[editingPositionId]?.note && dismissedNotePos !== editingPositionId && (
                <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[92vw]">
                    <div className="pointer-events-auto flex items-start gap-2.5 bg-amber-500 text-white shadow-2xl shadow-amber-500/40 rounded-2xl px-4 py-3 border border-amber-300/60">
                        <MessageSquare size={16} className="shrink-0 mt-0.5 text-amber-100" />
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-100 leading-none mb-1">
                                Ghi chú kiểm kê — vị trí {positions.find(p => p.id === editingPositionId)?.code}
                            </p>
                            <p className="text-sm font-bold leading-snug break-words">"{itemsMap[editingPositionId]?.note}"</p>
                        </div>
                        <button
                            onClick={() => setDismissedNotePos(editingPositionId)}
                            className="shrink-0 p-1 -mr-1 rounded-lg hover:bg-white/25 transition-all"
                            title="Đóng ghi chú"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="mx-auto -mt-1.5 h-3 w-3 rotate-45 bg-amber-500 border-b border-r border-amber-300/60 shadow-lg shadow-amber-500/30" />
                </div>
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

