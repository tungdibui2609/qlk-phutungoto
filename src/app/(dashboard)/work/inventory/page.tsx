'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ClipboardCheck, Plus, Loader2, ChevronRight, ChevronDown, Check, AlertCircle, Trash2, X, Calendar, User, BarChart3, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
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
}

interface Position {
    id: string
    code: string
    lot_id: string | null
    zone_id?: string | null
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

    // Create modal
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newName, setNewName] = useState('')
    const [newWhId, setNewWhId] = useState<string>('')
    const [allWarehouses, setAllWarehouses] = useState<Zone[]>([])
    const [creating, setCreating] = useState(false)

    // Warehouse filter
    const [selectedWh, setSelectedWh] = useState<string | null>(null)
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set())

    // ======== FETCH SESSIONS ========
    const fetchSessions = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('internal_inventory_sessions')
                .select('*')
                .eq('system_code', systemType)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Fetch creator names
            const userIds = [...new Set((data || []).map(s => s.created_by).filter(Boolean))]
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: users } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds as string[])
                users?.forEach((u: any) => { userMap[u.id] = u.full_name })
            }

            // Fetch warehouse names
            const whIds = [...new Set((data || []).map(s => s.warehouse_id).filter(Boolean))]
            let whMap: Record<string, string> = {}
            if (whIds.length > 0) {
                const { data: whs } = await supabase.from('zones').select('id, name').in('id', whIds as string[])
                whs?.forEach((w: any) => { whMap[w.id] = w.name })
            }

            // Fetch stats for each session
            const sessionIds = (data || []).map(s => s.id)
            let statsMap: Record<string, { total: number; checked: number; discrepancy: number }> = {}
            if (sessionIds.length > 0) {
                const { data: allItems } = await supabase
                    .from('internal_inventory_items')
                    .select('session_id, checked, note')
                    .in('session_id', sessionIds)

                if (allItems) {
                    allItems.forEach((item: any) => {
                        if (!statsMap[item.session_id]) statsMap[item.session_id] = { total: 0, checked: 0, discrepancy: 0 }
                        statsMap[item.session_id].total++
                        if (item.checked) statsMap[item.session_id].checked++
                        if (item.note) statsMap[item.session_id].discrepancy++
                    })
                }
            }

            setSessions((data || []).map(s => ({
                ...s,
                creator_name: s.created_by ? userMap[s.created_by] || 'N/A' : 'N/A',
                warehouse_name: s.warehouse_id ? whMap[s.warehouse_id] || 'N/A' : 'Tất cả kho',
                stats: statsMap[s.id] || { total: 0, checked: 0, discrepancy: 0 }
            })))
        } catch (e: any) {
            showToast('Lỗi tải danh sách phiếu: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, showToast])

    useEffect(() => { fetchSessions() }, [fetchSessions])

    // Load warehouses for create modal
    useEffect(() => {
        if (!systemType) return
        const fetchWhs = async () => {
            const { data } = await supabase
                .from('zones')
                .select('id, name')
                .eq('system_type', systemType)
                .is('parent_id', null)
                .order('display_order', { ascending: true })
            if (data) setAllWarehouses(data as any as Zone[])
        }
        fetchWhs()
    }, [systemType])

    // ======== CREATE SESSION ========
    const handleCreate = async () => {
        if (!systemType || !profile) return
        setCreating(true)
        try {
            const { data, error } = await supabase
                .from('internal_inventory_sessions')
                .insert({
                    name: newName.trim() || `Phiếu kiểm ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
                    status: 'active',
                    system_code: systemType,
                    company_id: profile.company_id,
                    created_by: profile.id,
                    warehouse_id: newWhId || null,
                })
                .select()
                .single()

            if (error) throw error
            showToast(`Đã tạo: ${data.name}`, 'success')
            setIsCreateOpen(false)
            setNewName('')
            setNewWhId('')
            fetchSessions()
        } catch (e: any) {
            showToast('Lỗi tạo phiếu: ' + e.message, 'error')
        } finally {
            setCreating(false)
        }
    }

    // ======== DELETE SESSION ========
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

    // ======== LOAD SESSION DETAIL ========
    const loadDetail = useCallback(async (session: Session) => {
        if (!systemType) return
        setDetailLoading(true)
        setSelectedSession(session)
        try {
            // Fetch zones, positions, zone_positions, items in parallel
            const [zonesRes, posRes, zpRes, itemsRes] = await Promise.all([
                supabase.from('zones').select('id, name, code, parent_id, level, display_order, is_hall').eq('system_type', systemType),
                supabase.from('positions').select('id, code, lot_id').eq('system_type', systemType),
                supabase.from('zone_positions').select('zone_id, position_id').order('zone_id'),
                supabase.from('internal_inventory_items').select('*').eq('session_id', session.id),
            ])

            if (zonesRes.error) throw zonesRes.error
            if (posRes.error) throw posRes.error
            if (zpRes.error) throw zpRes.error
            if (itemsRes.error) throw itemsRes.error

            // Build zone_id lookup
            const zpMap: Record<string, string> = {}
            zpRes.data?.forEach((zp: any) => { zpMap[zp.position_id] = zp.zone_id })

            const posWithZone = (posRes.data || []).map((p: any) => ({ ...p, zone_id: zpMap[p.id] || null }))

            setZones(zonesRes.data as any as Zone[] || [])
            setPositions(posWithZone)
            setItems(itemsRes.data || [])

            // Auto-select first warehouse
            const warehouses = (zonesRes.data || []).filter(z => !z.parent_id).sort((a, b) => {
                const oa = a.display_order ?? 0, ob = b.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
            })
            if (warehouses.length > 0) setSelectedWh(warehouses[0].id)

            // Fetch lot info for occupied positions
            const lotIds = [...new Set(posWithZone.map(p => p.lot_id).filter(Boolean))]
            if (lotIds.length > 0) {
                const { data: lots } = await supabase
                    .from('lots')
                    .select('id, code, lot_items(id, quantity, unit, products(name, sku, color))')
                    .in('id', lotIds)

                const infoMap: Record<string, any> = {}
                lots?.forEach((l: any) => {
                    infoMap[l.id] = {
                        code: l.code,
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
    }, [systemType, showToast])

    // ======== TOGGLE POSITION CHECK ========
    const toggleCheck = async (positionId: string) => {
        if (!selectedSession || !profile) return
        const existing = items.find(i => i.position_id === positionId)
        const newChecked = !existing?.checked

        // Optimistic update
        if (existing) {
            setItems(prev => prev.map(i => i.position_id === positionId ? { ...i, checked: newChecked, checked_at: new Date().toISOString() } : i))
        } else {
            const newItem: InvItem = {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: positions.find(p => p.id === positionId)?.zone_id || null,
                checked: true,
                note: null,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: positions.find(p => p.id === positionId)?.lot_id || null,
            }
            setItems(prev => [...prev, newItem])
        }

        // Upsert to Supabase
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
            }, { onConflict: 'session_id,position_id', ignoreDuplicates: false })
        } catch (e: any) {
            console.error('Check toggle error:', e)
        }
    }

    // ======== UPDATE NOTE ========
    const updateNote = async (positionId: string, note: string) => {
        if (!selectedSession || !profile) return
        const existing = items.find(i => i.position_id === positionId)

        // Optimistic
        if (existing) {
            setItems(prev => prev.map(i => i.position_id === positionId ? { ...i, note } : i))
        } else {
            setItems(prev => [...prev, {
                id: crypto.randomUUID(),
                session_id: selectedSession.id,
                position_id: positionId,
                zone_id: positions.find(p => p.id === positionId)?.zone_id || null,
                checked: false,
                note,
                checked_by: profile.id,
                checked_at: new Date().toISOString(),
                lot_id_snapshot: positions.find(p => p.id === positionId)?.lot_id || null,
            }])
        }

        // Debounced upsert
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
            }, { onConflict: 'session_id,position_id', ignoreDuplicates: false })
        } catch (e: any) {
            console.error('Note update error:', e)
        }
    }

    // ======== DERIVED DATA ========
    const itemsMap = useMemo(() => {
        const map: Record<string, InvItem> = {}
        items.forEach(i => { map[i.position_id] = i })
        return map
    }, [items])

    const sortedZones = useMemo(() => {
        return [...zones].sort((a, b) => {
            const oa = a.display_order ?? 0, ob = b.display_order ?? 0
            if (oa !== ob) return oa - ob
            return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
        })
    }, [zones])

    const warehouses = useMemo(() => sortedZones.filter(z => !z.parent_id), [sortedZones])
    const childrenMap = useMemo(() => {
        const map: Record<string, Zone[]> = {}
        sortedZones.forEach(z => {
            if (z.parent_id) {
                if (!map[z.parent_id]) map[z.parent_id] = []
                map[z.parent_id].push(z)
            }
        })
        return map
    }, [sortedZones])

    const getDescendantIds = useCallback((pid: string): string[] => {
        const ch = childrenMap[pid] || []
        return ch.reduce((acc: string[], c) => [...acc, c.id, ...getDescendantIds(c.id)], [pid])
    }, [childrenMap])

    const getZoneStats = useCallback((zoneId: string) => {
        const ids = getDescendantIds(zoneId)
        const zonePos = positions.filter(p => p.zone_id && ids.includes(p.zone_id))
        const total = zonePos.length
        const occupied = zonePos.filter(p => p.lot_id).length
        const checked = zonePos.filter(p => itemsMap[p.id]?.checked).length
        const discrepancy = zonePos.filter(p => itemsMap[p.id]?.note).length
        const pct = total > 0 ? Math.round((checked / total) * 100) : 0
        return { total, occupied, checked, discrepancy, pct }
    }, [getDescendantIds, positions, itemsMap])

    const buildingChildren = useMemo(() => {
        if (!selectedWh) return []
        return childrenMap[selectedWh] || []
    }, [selectedWh, childrenMap])

    const toggleExpand = (id: string) => {
        setExpandedZones(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    // ======== RENDER: Zone tree (recursive) ========
    const renderZoneTree = (zoneId: string, depth: number = 0): React.ReactNode => {
        const children = childrenMap[zoneId] || []
        const zonePos = positions.filter(p => p.zone_id === zoneId)
        const isExpanded = expandedZones.has(zoneId)
        const zone = zones.find(z => z.id === zoneId)
        if (!zone) return null

        // If this zone has positions directly, render them
        const hasDirectPositions = zonePos.length > 0
        const hasChildren = children.length > 0

        if (!hasDirectPositions && !hasChildren) return null

        return (
            <div key={zoneId} className={`${depth > 0 ? 'ml-4 border-l border-stone-100 pl-3' : ''}`}>
                <button
                    onClick={() => toggleExpand(zoneId)}
                    className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-stone-50 transition-colors text-left group"
                >
                    {(hasChildren || hasDirectPositions) && (
                        isExpanded
                            ? <ChevronDown size={14} className="text-stone-400" />
                            : <ChevronRight size={14} className="text-stone-400" />
                    )}
                    <span className="text-sm font-semibold text-stone-700 flex-1">{zone.name}</span>
                    {(() => {
                        const s = getZoneStats(zoneId)
                        if (s.total === 0) return null
                        return (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="bg-stone-100 px-2 py-0.5 rounded font-bold">{s.checked}/{s.total}</span>
                                {s.discrepancy > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold">{s.discrepancy} sai lệch</span>}
                                <span className={`font-bold ${s.pct === 100 ? 'text-green-600' : 'text-stone-400'}`}>{s.pct}%</span>
                            </div>
                        )
                    })()}
                </button>

                {isExpanded && (
                    <div className="mt-1">
                        {/* Direct positions of this zone */}
                        {hasDirectPositions && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 py-2 px-2">
                                {zonePos.map(pos => {
                                    const item = itemsMap[pos.id]
                                    const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
                                    const isChecked = item?.checked
                                    const hasNote = !!item?.note

                                    return (
                                        <div key={pos.id}
                                            className={`p-3 rounded-xl border transition-all ${isChecked ? 'bg-green-50 border-green-200' : hasNote ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-stone-500 font-mono">{pos.code}</span>
                                                    {lot && <span className="text-[10px] bg-stone-100 px-1.5 py-0.5 rounded font-bold text-stone-500">LOT: {lot.code}</span>}
                                                </div>
                                                <button
                                                    onClick={() => toggleCheck(pos.id)}
                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isChecked ? 'bg-green-500 text-white' : 'bg-stone-100 text-stone-400 hover:bg-stone-200'}`}
                                                >
                                                    <Check size={16} strokeWidth={3} />
                                                </button>
                                            </div>
                                            {lot ? (
                                                <div className="text-xs text-stone-600 mb-2">
                                                    {lot.items?.[0] && (
                                                        <div>
                                                            <span className="font-bold text-teal-700">{lot.items[0].sku}</span>
                                                            <span className="text-stone-400 ml-1">{lot.items[0].product_name}</span>
                                                            <span className="text-blue-600 font-bold ml-2">{lot.items[0].quantity} {lot.items[0].unit}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-stone-300 italic mb-2">Trống</div>
                                            )}
                                            <input
                                                type="text"
                                                value={item?.note || ''}
                                                onChange={(e) => updateNote(pos.id, e.target.value)}
                                                placeholder="Ghi chú sai lệch..."
                                                className="w-full text-xs px-2 py-1.5 rounded-lg bg-stone-50 border border-stone-200 focus:border-orange-400 focus:ring-1 focus:ring-orange-200 outline-none transition-all placeholder:text-stone-300"
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                        {/* Children zones */}
                        {children.map(child => renderZoneTree(child.id, depth + 1))}
                    </div>
                )}
            </div>
        )
    }

    // ======== MAIN RENDER ========
    return (
        <div className="p-2 md:p-4 w-full mx-auto space-y-6 pb-24 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                        <ClipboardCheck className="text-purple-600" />
                        Kiểm Kê Nội Bộ
                    </h1>
                    <p className="text-stone-500 mt-1">Kiểm tra vật lý từng vị trí trong kho — đồng bộ với ứng dụng mobile</p>
                </div>
                <button
                    onClick={() => { setNewName(''); setNewWhId(''); setIsCreateOpen(true) }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
                >
                    <Plus size={18} />
                    Tạo phiếu kiểm
                </button>
            </div>

            {/* ======= SESSION LIST or DETAIL ======= */}
            {selectedSession ? (
                /* ======= DETAIL VIEW ======= */
                <div className="space-y-4">
                    {/* Back button + session info */}
                    <div className="flex items-center gap-4 bg-white rounded-xl border border-stone-200 p-4">
                        <button onClick={() => { setSelectedSession(null); fetchSessions() }} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
                            <X size={20} className="text-stone-500" />
                        </button>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-stone-800">{selectedSession.name}</h2>
                            <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(selectedSession.created_at), 'HH:mm dd/MM/yyyy')}</span>
                                <span className="flex items-center gap-1"><User size={12} /> {selectedSession.creator_name}</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${selectedSession.status === 'active' ? 'bg-blue-100 text-blue-700' : selectedSession.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-600'}`}>
                                    {selectedSession.status === 'active' ? 'Đang kiểm' : selectedSession.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                                </span>
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
                                    <div><div className="text-lg font-black text-stone-800">{checked}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Đã kiểm</div></div>
                                    <div><div className="text-lg font-black text-stone-800">{total}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Tổng</div></div>
                                    {disc > 0 && <div><div className="text-lg font-black text-red-600">{disc}</div><div className="text-[10px] text-stone-400 font-bold uppercase">Sai lệch</div></div>}
                                </div>
                            )
                        })()}
                    </div>

                    {detailLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
                    ) : (
                        <>
                            {/* Warehouse tabs */}
                            <div className="flex gap-2 flex-wrap">
                                {warehouses.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => { setSelectedWh(w.id); setExpandedZones(new Set()) }}
                                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedWh === w.id ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                                    >
                                        {w.name}
                                    </button>
                                ))}
                            </div>

                            {/* Summary cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {buildingChildren.map(zone => {
                                    const s = getZoneStats(zone.id)
                                    const displayName = zone.is_hall
                                        ? (zone.name.toUpperCase().includes('SẢNH') ? zone.name : `SẢNH ${zone.name}`)
                                        : zone.name

                                    return (
                                        <button
                                            key={zone.id}
                                            onClick={() => { setExpandedZones(prev => { const n = new Set(prev); n.add(zone.id); return n }) }}
                                            className="p-4 rounded-xl border border-stone-200 bg-white hover:shadow-md transition-all text-left group"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="font-bold text-stone-800">{displayName}</h3>
                                                <span className={`text-sm font-black ${s.pct === 100 ? 'text-green-600' : 'text-purple-600'}`}>{s.pct}%</span>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                                <div><div className="text-lg font-black text-stone-800">{s.total}</div><div className="text-stone-400 font-bold uppercase">Tổng</div></div>
                                                <div><div className="text-lg font-black text-blue-600">{s.occupied}</div><div className="text-stone-400 font-bold uppercase">Đã dùng</div></div>
                                                <div><div className="text-lg font-black text-green-600">{s.checked}</div><div className="text-stone-400 font-bold uppercase">Đã kiểm</div></div>
                                                <div><div className={`text-lg font-black ${s.discrepancy > 0 ? 'text-red-600' : 'text-stone-300'}`}>{s.discrepancy}</div><div className="text-stone-400 font-bold uppercase">Sai lệch</div></div>
                                            </div>
                                            {/* Progress bar */}
                                            <div className="mt-3 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full transition-all ${s.pct === 100 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${s.pct}%` }} />
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Zone tree */}
                            <div className="bg-white rounded-xl border border-stone-200 p-4">
                                <h3 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-3">Chi tiết vị trí</h3>
                                {buildingChildren.map(zone => renderZoneTree(zone.id, 0))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* ======= SESSION LIST ======= */
                loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-purple-600" size={32} /></div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-20 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                        <ClipboardCheck size={48} className="mx-auto text-stone-300 mb-4" />
                        <p className="text-stone-500 font-bold">Chưa có phiếu kiểm kê nội bộ nào</p>
                        <p className="text-stone-400 text-sm mt-1">Bấm nút "Tạo phiếu kiểm" để bắt đầu</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {sessions.map(session => {
                            const s = session.stats || { total: 0, checked: 0, discrepancy: 0 }
                            const pct = s.total > 0 ? Math.round((s.checked / s.total) * 100) : 0
                            return (
                                <div
                                    key={session.id}
                                    className="bg-white rounded-xl border border-stone-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                                    onClick={() => loadDetail(session)}
                                >
                                    <div className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${session.status === 'active' ? 'bg-purple-100 text-purple-600' : 'bg-stone-100 text-stone-400'}`}>
                                                <ClipboardCheck size={22} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-stone-800">{session.name}</h3>
                                                <div className="flex items-center gap-3 text-xs text-stone-500 mt-1">
                                                    <span className="font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{session.warehouse_name}</span>
                                                    <span>•</span>
                                                    <span>{format(new Date(session.created_at), 'HH:mm dd/MM/yyyy')}</span>
                                                    <span>•</span>
                                                    <span>{session.creator_name}</span>
                                                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${session.status === 'active' ? 'bg-blue-100 text-blue-700' : session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-600'}`}>
                                                        {session.status === 'active' ? 'Đang kiểm' : session.status === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {s.total > 0 && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <div className="flex items-center gap-1 text-green-600"><CheckCircle2 size={14} /><span className="font-bold">{s.checked}</span></div>
                                                    {s.discrepancy > 0 && <div className="flex items-center gap-1 text-red-600"><AlertTriangle size={14} /><span className="font-bold">{s.discrepancy}</span></div>}
                                                    <span className="font-black text-purple-600">{pct}%</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                                                className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                    {s.total > 0 && (
                                        <div className="px-4 pb-3">
                                            <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            )}

            {/* ======= CREATE MODAL ======= */}
            {isCreateOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in" onClick={() => setIsCreateOpen(false)}>
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-stone-800 mb-1">Tạo Phiếu Kiểm Mới</h2>
                        <p className="text-xs text-stone-400 mb-5">Đặt tên để dễ tìm lại sau này</p>
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder={`VD: Kiểm kê tháng ${new Date().getMonth() + 1}`}
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all mb-4"
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                        />

                        <div className="mb-6">
                            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1 mb-1.5 block">Khu vực kiểm kê</label>
                            <select
                                value={newWhId}
                                onChange={e => setNewWhId(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm font-medium focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all cursor-pointer bg-white"
                            >
                                <option value="">-- Tất cả kho --</option>
                                {allWarehouses.map(w => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsCreateOpen(false)} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-500 font-bold text-sm hover:bg-stone-50 transition-colors">
                                Hủy
                            </button>
                            <button onClick={handleCreate} disabled={creating} className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {creating && <Loader2 size={16} className="animate-spin" />}
                                Tạo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
