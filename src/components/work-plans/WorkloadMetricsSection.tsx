'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
    Link2,
    ExternalLink,
    MapPin,
    Boxes,
    Package,
    Scale,
    Clock,
    Flame,
    Check,
    Search,
    Sparkles,
    Truck,
    Loader2,
    ArrowDownToLine,
    ArrowUpFromLine,
    Calendar,
    Layers,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
    WorkloadMetrics,
    WorkloadDifficulty,
    LinkedExportOrderSummary,
    LinkedAccountingOrderSummary,
    LinkedLotDateSummary,
    DIFFICULTY_CONFIG,
    QUANTITY_FACTOR_PRESETS,
    QuantityFactorPreset,
    parseUnitWeightKg,
    suggestWorkloadDifficulty,
    recalculateWorkloadFromLinkedSources,
    applyQuantityFactorToMetrics,
    formatVNDateSlash,
} from './types'

interface WorkloadMetricsSectionProps {
    systemCode: string
    planDate: string
    value: WorkloadMetrics
    onChange: (next: WorkloadMetrics) => void
}

type ProofSourceTab = 'export_order' | 'inbound' | 'outbound' | 'lots_by_date' | null

const DIFFICULTY_KEYS: WorkloadDifficulty[] = ['light', 'medium', 'heavy', 'very_heavy']

export default function WorkloadMetricsSection({
    systemCode,
    planDate,
    value,
    onChange,
}: WorkloadMetricsSectionProps) {
    const [activeSourceTab, setActiveSourceTab] = useState<ProofSourceTab>(null)

    // 1. Export Orders (/work/export-order)
    const [exportOrders, setExportOrders] = useState<LinkedExportOrderSummary[]>([])
    const [loadingExportOrders, setLoadingExportOrders] = useState<boolean>(false)
    const [searchExportOrder, setSearchExportOrder] = useState<string>('')

    // 2. Inbound Accounting Orders (/inbound)
    const [inboundOrders, setInboundOrders] = useState<LinkedAccountingOrderSummary[]>([])
    const [loadingInbound, setLoadingInbound] = useState<boolean>(false)
    const [searchInbound, setSearchInbound] = useState<string>('')

    // 3. Outbound Accounting Orders (/outbound)
    const [outboundOrders, setOutboundOrders] = useState<LinkedAccountingOrderSummary[]>([])
    const [loadingOutbound, setLoadingOutbound] = useState<boolean>(false)
    const [searchOutbound, setSearchOutbound] = useState<string>('')

    // 4. LOTs Created by Date (/warehouses/lots)
    const [lotFilterDate, setLotFilterDate] = useState<string>(planDate)
    const [lotDateSummaries, setLotDateSummaries] = useState<LinkedLotDateSummary[]>([])
    const [loadingLotSummaries, setLoadingLotSummaries] = useState<boolean>(false)

    useEffect(() => {
        if (planDate) setLotFilterDate(planDate)
    }, [planDate])

    // Fetch Export Orders when tab is 'export_order'
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'export_order') return
        let cancelled = false

        const fetchExportOrders = async () => {
            setLoadingExportOrders(true)
            try {
                const { data, error } = await (supabase as any)
                    .from('export_tasks')
                    .select(
                        `
                        id,
                        code,
                        status,
                        created_at,
                        export_task_items (
                            id,
                            position_id,
                            lot_id,
                            quantity,
                            exported_quantity,
                            unit
                        )
                    `
                    )
                    .eq('system_code', systemCode)
                    .order('created_at', { ascending: false })
                    .limit(40)

                if (error) throw error
                if (cancelled) return

                const summaries: LinkedExportOrderSummary[] = (data || []).map((t: any) => {
                    const rawItems = Array.isArray(t.export_task_items)
                        ? t.export_task_items
                        : []
                    const posSet = new Set<string>()
                    const lotSet = new Set<string>()
                    let totalQty = 0
                    let exportedQty = 0
                    let totalWeightKg = 0
                    const unitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        if (it.position_id) posSet.add(it.position_id)
                        if (it.lot_id) lotSet.add(it.lot_id)
                        const q = Number(it.quantity) || 0
                        const eq = Number(it.exported_quantity) || 0
                        totalQty += q
                        exportedQty += eq
                        const u = (it.unit || 'Thùng').trim()
                        unitCounts[u] = (unitCounts[u] || 0) + q
                        const wPerUnit = parseUnitWeightKg(u)
                        if (wPerUnit) {
                            totalWeightKg += q * wPerUnit
                        }
                    })

                    const dominantUnit =
                        Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'

                    return {
                        id: t.id,
                        code: t.code || 'Lệnh xuất',
                        status: t.status || 'Pending',
                        created_at: t.created_at,
                        positions_count: posSet.size || rawItems.length,
                        lots_count: lotSet.size || rawItems.length,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        exported_quantity: Math.round(exportedQty * 100) / 100,
                        unit: dominantUnit,
                        estimated_weight_kg:
                            totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                })

                setExportOrders(summaries)
            } catch (err) {
                console.error('Error loading export orders for workload metrics:', err)
            } finally {
                if (!cancelled) setLoadingExportOrders(false)
            }
        }

        fetchExportOrders()
        return () => {
            cancelled = true
        }
    }, [systemCode, activeSourceTab])

    // Fetch Inbound Accounting Orders (/inbound)
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'inbound') return
        let cancelled = false

        const fetchInbound = async () => {
            setLoadingInbound(true)
            try {
                const { data, error } = await (supabase as any)
                    .from('inbound_orders')
                    .select(
                        `
                        id,
                        code,
                        status,
                        warehouse_name,
                        description,
                        created_at,
                        supplier:suppliers(name),
                        items:inbound_order_items(
                            id,
                            product_name,
                            quantity,
                            unit
                        )
                    `
                    )
                    .eq('system_code', systemCode)
                    .order('created_at', { ascending: false })
                    .limit(45)

                if (error) throw error
                if (cancelled) return

                const summaries: LinkedAccountingOrderSummary[] = (data || []).map((ord: any) => {
                    const rawItems = Array.isArray(ord.items) ? ord.items : []
                    let totalQty = 0
                    let totalWeightKg = 0
                    const unitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        const q = Number(it.quantity) || 0
                        totalQty += q
                        const u = (it.unit || 'Thùng').trim()
                        unitCounts[u] = (unitCounts[u] || 0) + q
                        const w = parseUnitWeightKg(u)
                        if (w) totalWeightKg += q * w
                    })

                    const dominantUnit =
                        Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'

                    const supplierName = Array.isArray(ord.supplier)
                        ? ord.supplier[0]?.name
                        : ord.supplier?.name

                    return {
                        id: ord.id,
                        code: ord.code,
                        order_kind: 'inbound',
                        status: ord.status || 'Completed',
                        created_at: ord.created_at,
                        partner_name: supplierName || null,
                        warehouse_name: ord.warehouse_name || null,
                        description: ord.description || null,
                        items_count: rawItems.length,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        unit: dominantUnit,
                        estimated_weight_kg: totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                })

                setInboundOrders(summaries)
            } catch (err) {
                console.error('Error loading inbound orders for workload:', err)
            } finally {
                if (!cancelled) setLoadingInbound(false)
            }
        }

        fetchInbound()
        return () => {
            cancelled = true
        }
    }, [systemCode, activeSourceTab])

    // Fetch Outbound Accounting Orders (/outbound)
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'outbound') return
        let cancelled = false

        const fetchOutbound = async () => {
            setLoadingOutbound(true)
            try {
                const { data, error } = await (supabase as any)
                    .from('outbound_orders')
                    .select(
                        `
                        id,
                        code,
                        status,
                        warehouse_name,
                        customer_name,
                        description,
                        created_at,
                        items:outbound_order_items(
                            id,
                            product_name,
                            quantity,
                            unit
                        )
                    `
                    )
                    .eq('system_code', systemCode)
                    .order('created_at', { ascending: false })
                    .limit(45)

                if (error) throw error
                if (cancelled) return

                const summaries: LinkedAccountingOrderSummary[] = (data || []).map((ord: any) => {
                    const rawItems = Array.isArray(ord.items) ? ord.items : []
                    let totalQty = 0
                    let totalWeightKg = 0
                    const unitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        const q = Number(it.quantity) || 0
                        totalQty += q
                        const u = (it.unit || 'Thùng').trim()
                        unitCounts[u] = (unitCounts[u] || 0) + q
                        const w = parseUnitWeightKg(u)
                        if (w) totalWeightKg += q * w
                    })

                    const dominantUnit =
                        Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'

                    return {
                        id: ord.id,
                        code: ord.code,
                        order_kind: 'outbound',
                        status: ord.status || 'Completed',
                        created_at: ord.created_at,
                        partner_name: ord.customer_name || null,
                        warehouse_name: ord.warehouse_name || null,
                        description: ord.description || null,
                        items_count: rawItems.length,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        unit: dominantUnit,
                        estimated_weight_kg: totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                })

                setOutboundOrders(summaries)
            } catch (err) {
                console.error('Error loading outbound orders for workload:', err)
            } finally {
                if (!cancelled) setLoadingOutbound(false)
            }
        }

        fetchOutbound()
        return () => {
            cancelled = true
        }
    }, [systemCode, activeSourceTab])

    // Fetch LOTs Created by Date (/warehouses/lots)
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'lots_by_date' || !lotFilterDate) return
        let cancelled = false

        const fetchLotsByDate = async () => {
            setLoadingLotSummaries(true)
            try {
                const startIso = new Date(`${lotFilterDate}T00:00:00`).toISOString()
                const endIso = new Date(`${lotFilterDate}T23:59:59.999`).toISOString()

                const [zonesRes, lotsRes] = await Promise.all([
                    (supabase as any)
                        .from('zones')
                        .select('id, parent_id, name, code, level, display_order')
                        .eq('system_type', systemCode)
                        .order('level')
                        .order('display_order')
                        .order('name'),
                    (supabase as any)
                        .from('lots')
                        .select(
                            `
                            id,
                            code,
                            quantity,
                            created_at,
                            warehouse_name,
                            lot_items(id, quantity, unit),
                            positions!positions_lot_id_fkey(id, code, zone_positions(zone_id))
                        `
                        )
                        .eq('system_code', systemCode)
                        .neq('status', 'hidden')
                        .neq('status', 'exported')
                        .gte('created_at', startIso)
                        .lte('created_at', endIso),
                ])

                if (lotsRes.error) throw lotsRes.error
                if (cancelled) return

                const allZones: any[] = zonesRes.data || []
                const zoneById = new Map<string, any>(allZones.map(z => [z.id, z]))
                const rootZones = allZones.filter(z => !z.parent_id)

                const findRootZone = (zId: string): any | null => {
                    let cur = zoneById.get(zId)
                    let guard = 0
                    while (cur && cur.parent_id && zoneById.has(cur.parent_id) && guard < 12) {
                        cur = zoneById.get(cur.parent_id)
                        guard++
                    }
                    return cur || null
                }

                const rawLots: any[] = lotsRes.data || []

                // Helper to build a LinkedLotDateSummary from a subset of lots
                const buildSummary = (
                    subset: any[],
                    zoneId: string | null,
                    zoneName: string
                ): LinkedLotDateSummary => {
                    let totalQty = 0
                    let totalWeightKg = 0
                    let assignedPosCount = 0
                    const unitCounts: Record<string, number> = {}

                    subset.forEach(l => {
                        const positions = Array.isArray(l.positions) ? l.positions : []
                        assignedPosCount += positions.length

                        const items = Array.isArray(l.lot_items) ? l.lot_items : []
                        if (items.length > 0) {
                            items.forEach((it: any) => {
                                const q = Number(it.quantity) || 0
                                totalQty += q
                                const u = (it.unit || 'Thùng').trim()
                                unitCounts[u] = (unitCounts[u] || 0) + q
                                const w = parseUnitWeightKg(u)
                                if (w) totalWeightKg += q * w
                            })
                        } else {
                            const q = Number(l.quantity) || 0
                            totalQty += q
                            unitCounts['Thùng'] = (unitCounts['Thùng'] || 0) + q
                        }
                    })

                    const dominantUnit =
                        Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'

                    return {
                        id: `${lotFilterDate}_${zoneId || 'ALL'}`,
                        created_date: lotFilterDate,
                        zone_id: zoneId,
                        zone_name: zoneName,
                        lots_count: subset.length,
                        assigned_positions_count: assignedPosCount,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        unit: dominantUnit,
                        estimated_weight_kg:
                            totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                }

                const results: LinkedLotDateSummary[] = []

                if (rawLots.length > 0) {
                    // 1. All LOTs created on this date
                    results.push(buildSummary(rawLots, null, 'Tất cả kho'))

                    // 2. Group by Root Zone (KHO 1, KHO 2, KHO 3...)
                    const byRootZone = new Map<string, any[]>()
                    const unassignedLots: any[] = []

                    rawLots.forEach(l => {
                        const positions = Array.isArray(l.positions) ? l.positions : []
                        if (positions.length === 0) {
                            unassignedLots.push(l)
                            return
                        }
                        const matchedRootIds = new Set<string>()
                        positions.forEach((p: any) => {
                            const zps = Array.isArray(p.zone_positions)
                                ? p.zone_positions
                                : []
                            zps.forEach((zp: any) => {
                                if (zp.zone_id) {
                                    const root = findRootZone(zp.zone_id)
                                    if (root?.id) matchedRootIds.add(root.id)
                                }
                            })
                        })

                        if (matchedRootIds.size === 0) {
                            // Fallback by position code prefix against rootZones code
                            const posCode = (positions[0]?.code || '').toUpperCase()
                            const matchedRoot = rootZones.find(
                                rz => rz.code && posCode.startsWith(String(rz.code).toUpperCase())
                            )
                            if (matchedRoot) matchedRootIds.add(matchedRoot.id)
                        }

                        if (matchedRootIds.size === 0) {
                            unassignedLots.push(l)
                        } else {
                            matchedRootIds.forEach(rId => {
                                const arr = byRootZone.get(rId) || []
                                arr.push(l)
                                byRootZone.set(rId, arr)
                            })
                        }
                    })

                    rootZones.forEach(rz => {
                        const group = byRootZone.get(rz.id)
                        if (group && group.length > 0) {
                            results.push(buildSummary(group, rz.id, rz.name))
                        }
                    })
                }

                setLotDateSummaries(results)
            } catch (err) {
                console.error('Error loading LOT summaries by date:', err)
            } finally {
                if (!cancelled) setLoadingLotSummaries(false)
            }
        }

        fetchLotsByDate()
        return () => {
            cancelled = true
        }
    }, [systemCode, activeSourceTab, lotFilterDate])

    // Filtered lists
    const filteredExportOrders = useMemo(() => {
        const q = searchExportOrder.trim().toLowerCase()
        if (!q) return exportOrders
        return exportOrders.filter(o => o.code.toLowerCase().includes(q))
    }, [exportOrders, searchExportOrder])

    const filteredInboundOrders = useMemo(() => {
        const q = searchInbound.trim().toLowerCase()
        if (!q) return inboundOrders
        return inboundOrders.filter(
            o =>
                o.code.toLowerCase().includes(q) ||
                (o.partner_name || '').toLowerCase().includes(q) ||
                (o.description || '').toLowerCase().includes(q)
        )
    }, [inboundOrders, searchInbound])

    const filteredOutboundOrders = useMemo(() => {
        const q = searchOutbound.trim().toLowerCase()
        if (!q) return outboundOrders
        return outboundOrders.filter(
            o =>
                o.code.toLowerCase().includes(q) ||
                (o.partner_name || '').toLowerCase().includes(q) ||
                (o.description || '').toLowerCase().includes(q)
        )
    }, [outboundOrders, searchOutbound])

    // Toggle handlers for each of the 4 sources
    const handleToggleExportOrder = (order: LinkedExportOrderSummary) => {
        const current = Array.isArray(value.linked_export_orders)
            ? value.linked_export_orders
            : []
        const exists = current.some(o => o.id === order.id)
        const nextLinked = exists
            ? current.filter(o => o.id !== order.id)
            : [...current, order]

        const nextMetrics = recalculateWorkloadFromLinkedSources({
            ...value,
            linked_export_orders: nextLinked,
        })
        onChange(nextMetrics)
    }

    const handleToggleInboundOrder = (order: LinkedAccountingOrderSummary) => {
        const current = Array.isArray(value.linked_inbound_orders)
            ? value.linked_inbound_orders
            : []
        const exists = current.some(o => o.id === order.id)
        const nextLinked = exists
            ? current.filter(o => o.id !== order.id)
            : [...current, order]

        const nextMetrics = recalculateWorkloadFromLinkedSources({
            ...value,
            linked_inbound_orders: nextLinked,
        })
        onChange(nextMetrics)
    }

    const handleToggleOutboundOrder = (order: LinkedAccountingOrderSummary) => {
        const current = Array.isArray(value.linked_outbound_orders)
            ? value.linked_outbound_orders
            : []
        const exists = current.some(o => o.id === order.id)
        const nextLinked = exists
            ? current.filter(o => o.id !== order.id)
            : [...current, order]

        const nextMetrics = recalculateWorkloadFromLinkedSources({
            ...value,
            linked_outbound_orders: nextLinked,
        })
        onChange(nextMetrics)
    }

    const handleToggleLotSummary = (summary: LinkedLotDateSummary) => {
        const current = Array.isArray(value.linked_lot_summaries)
            ? value.linked_lot_summaries
            : []
        const exists = current.some(s => s.id === summary.id)
        const nextLinked = exists
            ? current.filter(s => s.id !== summary.id)
            : [...current, summary]

        const nextMetrics = recalculateWorkloadFromLinkedSources({
            ...value,
            linked_lot_summaries: nextLinked,
        })
        onChange(nextMetrics)
    }

    const updateNumericField = (
        field: keyof WorkloadMetrics,
        rawVal: string,
        autoDifficulty = true
    ) => {
        const parsed = rawVal === '' ? null : Number(rawVal)
        const num = parsed !== null && !isNaN(parsed) ? parsed : null
        const currentFactor =
            value.quantity_factor && value.quantity_factor > 0
                ? value.quantity_factor
                : 1

        const next: WorkloadMetrics = {
            ...value,
            [field]: num,
        }

        // Sync base field when user manually edits one of the 4 scaled metrics
        if (field === 'positions_count') {
            next.base_positions_count =
                num !== null ? Math.round((num / currentFactor) * 100) / 100 : null
        } else if (field === 'lots_count') {
            next.base_lots_count =
                num !== null ? Math.round((num / currentFactor) * 100) / 100 : null
        } else if (field === 'packages_count') {
            next.base_packages_count =
                num !== null ? Math.round((num / currentFactor) * 100) / 100 : null
        } else if (field === 'weight_kg') {
            next.base_weight_kg =
                num !== null ? Math.round((num / currentFactor) * 100) / 100 : null
        }

        if (autoDifficulty) {
            next.difficulty = suggestWorkloadDifficulty(next)
        }
        onChange(next)
    }

    const handleSelectQuantityFactor = (preset: QuantityFactorPreset) => {
        const allAutoSuggestions = new Set(
            QUANTITY_FACTOR_PRESETS.flatMap(p => p.suggestedReasons)
        )
        const currentNote = (value.quantity_adjustment_note || '').trim()
        const shouldAutoFillNote =
            preset.factor !== 1 &&
            (!currentNote || allAutoSuggestions.has(currentNote)) &&
            preset.suggestedReasons.length > 0

        const updated = applyQuantityFactorToMetrics(
            value,
            preset.factor,
            preset.label
        )
        if (shouldAutoFillNote) {
            updated.quantity_adjustment_note = preset.suggestedReasons[0]
        }
        onChange(updated)
    }

    const exportCount = value.linked_export_orders?.length || 0
    const inboundCount = value.linked_inbound_orders?.length || 0
    const outboundCount = value.linked_outbound_orders?.length || 0
    const lotSummaryCount = value.linked_lot_summaries?.length || 0

    return (
        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/30 p-4 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                        <Scale size={15} />
                    </div>
                    <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950">
                            Số Liệu Chứng Minh Khối Lượng & Độ Nặng / Nhẹ
                        </h4>
                        <p className="text-[11px] text-stone-500">
                            Gắn số liệu thực tế từ Lệnh xuất kho, Nhập/Xuất kế toán hoặc Số LOT được tạo theo ngày
                        </p>
                    </div>
                </div>
            </div>

            {/* 4 Source Selector Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                    type="button"
                    onClick={() =>
                        setActiveSourceTab(prev =>
                            prev === 'export_order' ? null : 'export_order'
                        )
                    }
                    className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                        activeSourceTab === 'export_order'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : exportCount > 0
                              ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                            <span>📦 Lệnh xuất kho</span>
                        </div>
                        <div
                            className={`text-[10px] truncate ${
                                activeSourceTab === 'export_order'
                                    ? 'text-indigo-100'
                                    : 'text-stone-400'
                            }`}
                        >
                            /work/export-order
                        </div>
                    </div>
                    {exportCount > 0 && (
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                activeSourceTab === 'export_order'
                                    ? 'bg-white text-indigo-700'
                                    : 'bg-indigo-600 text-white'
                            }`}
                        >
                            {exportCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setActiveSourceTab(prev => (prev === 'inbound' ? null : 'inbound'))
                    }
                    className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                        activeSourceTab === 'inbound'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : inboundCount > 0
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                            <ArrowDownToLine size={13} className="shrink-0" />
                            <span>Nhập kế toán</span>
                        </div>
                        <div
                            className={`text-[10px] truncate ${
                                activeSourceTab === 'inbound'
                                    ? 'text-emerald-100'
                                    : 'text-stone-400'
                            }`}
                        >
                            /inbound
                        </div>
                    </div>
                    {inboundCount > 0 && (
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                activeSourceTab === 'inbound'
                                    ? 'bg-white text-emerald-700'
                                    : 'bg-emerald-600 text-white'
                            }`}
                        >
                            {inboundCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setActiveSourceTab(prev => (prev === 'outbound' ? null : 'outbound'))
                    }
                    className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                        activeSourceTab === 'outbound'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : outboundCount > 0
                              ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                            <ArrowUpFromLine size={13} className="shrink-0" />
                            <span>Xuất kế toán</span>
                        </div>
                        <div
                            className={`text-[10px] truncate ${
                                activeSourceTab === 'outbound'
                                    ? 'text-amber-100'
                                    : 'text-stone-400'
                            }`}
                        >
                            /outbound
                        </div>
                    </div>
                    {outboundCount > 0 && (
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                activeSourceTab === 'outbound'
                                    ? 'bg-white text-amber-700'
                                    : 'bg-amber-600 text-white'
                            }`}
                        >
                            {outboundCount}
                        </span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setActiveSourceTab(prev =>
                            prev === 'lots_by_date' ? null : 'lots_by_date'
                        )
                    }
                    className={`px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 ${
                        activeSourceTab === 'lots_by_date'
                            ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                            : lotSummaryCount > 0
                              ? 'bg-teal-50 text-teal-900 border-teal-300 font-bold'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="min-w-0">
                        <div className="text-xs font-extrabold truncate flex items-center gap-1">
                            <Layers size={13} className="shrink-0" />
                            <span>Số LOT tạo</span>
                        </div>
                        <div
                            className={`text-[10px] truncate ${
                                activeSourceTab === 'lots_by_date'
                                    ? 'text-teal-100'
                                    : 'text-stone-400'
                            }`}
                        >
                            /warehouses/lots
                        </div>
                    </div>
                    {lotSummaryCount > 0 && (
                        <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                activeSourceTab === 'lots_by_date'
                                    ? 'bg-white text-teal-700'
                                    : 'bg-teal-600 text-white'
                            }`}
                        >
                            {lotSummaryCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Active Linked Proof Badges (All 4 Sources) */}
            {(exportCount > 0 ||
                inboundCount > 0 ||
                outboundCount > 0 ||
                lotSummaryCount > 0) && (
                <div className="space-y-1.5 bg-white/80 p-2.5 rounded-xl border border-indigo-100">
                    <div className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider">
                        Nguồn số liệu đã gắn chứng minh:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {/* 1. Linked Export Orders */}
                        {(value.linked_export_orders || []).map(ord => (
                            <div
                                key={`exp_${ord.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs"
                            >
                                <span className="font-extrabold text-indigo-800">
                                    📦 {ord.code}
                                </span>
                                <span className="text-stone-600 font-semibold">
                                    • <b>{ord.positions_count}</b> vị trí •{' '}
                                    <b>{ord.total_quantity.toLocaleString('vi-VN')}</b> {ord.unit}
                                </span>
                                <Link
                                    href={`/work/export-order/${ord.id}`}
                                    target="_blank"
                                    className="px-1.5 py-0.5 rounded-md bg-white hover:bg-indigo-100 text-indigo-700 font-bold inline-flex items-center gap-0.5 border border-indigo-200"
                                >
                                    Mở lệnh <ExternalLink size={10} />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleToggleExportOrder(ord)}
                                    className="text-stone-400 hover:text-rose-600 font-bold ml-0.5"
                                    title="Gỡ liên kết"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* 2. Linked Inbound Accounting Orders */}
                        {(value.linked_inbound_orders || []).map(ord => (
                            <div
                                key={`inb_${ord.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200 text-xs"
                            >
                                <span className="font-extrabold text-emerald-800">
                                    📥 Phiếu nhập {ord.code}
                                </span>
                                <span className="text-stone-600 font-semibold">
                                    • <b>{ord.items_count}</b> dòng •{' '}
                                    <b>{ord.total_quantity.toLocaleString('vi-VN')}</b> {ord.unit}
                                </span>
                                <Link
                                    href={`/inbound?editCode=${encodeURIComponent(ord.code)}`}
                                    target="_blank"
                                    className="px-1.5 py-0.5 rounded-md bg-white hover:bg-emerald-100 text-emerald-700 font-bold inline-flex items-center gap-0.5 border border-emerald-200"
                                >
                                    Xem phiếu <ExternalLink size={10} />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleToggleInboundOrder(ord)}
                                    className="text-stone-400 hover:text-rose-600 font-bold ml-0.5"
                                    title="Gỡ liên kết"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* 3. Linked Outbound Accounting Orders */}
                        {(value.linked_outbound_orders || []).map(ord => (
                            <div
                                key={`out_${ord.id}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-50/90 border border-amber-200 text-xs"
                            >
                                <span className="font-extrabold text-amber-800">
                                    📤 Phiếu xuất {ord.code}
                                </span>
                                <span className="text-stone-600 font-semibold">
                                    • <b>{ord.items_count}</b> dòng •{' '}
                                    <b>{ord.total_quantity.toLocaleString('vi-VN')}</b> {ord.unit}
                                </span>
                                <Link
                                    href={`/outbound?editCode=${encodeURIComponent(ord.code)}`}
                                    target="_blank"
                                    className="px-1.5 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-700 font-bold inline-flex items-center gap-0.5 border border-amber-200"
                                >
                                    Xem phiếu <ExternalLink size={10} />
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => handleToggleOutboundOrder(ord)}
                                    className="text-stone-400 hover:text-rose-600 font-bold ml-0.5"
                                    title="Gỡ liên kết"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {/* 4. Linked Created LOT Summaries */}
                        {(value.linked_lot_summaries || []).map(lotSum => {
                            const lotHref = `/warehouses/lots?createdDate=${lotSum.created_date}${
                                lotSum.zone_id ? `&zoneId=${lotSum.zone_id}` : ''
                            }`
                            return (
                                <div
                                    key={`lot_${lotSum.id}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-50/90 border border-teal-200 text-xs"
                                >
                                    <span className="font-extrabold text-teal-800">
                                        🏷️ {lotSum.lots_count} LOT tạo ngày{' '}
                                        {formatVNDateSlash(lotSum.created_date)} (
                                        {lotSum.zone_name})
                                    </span>
                                    <span className="text-stone-600 font-semibold">
                                        •{' '}
                                        <b>
                                            {lotSum.total_quantity.toLocaleString('vi-VN')}
                                        </b>{' '}
                                        {lotSum.unit}
                                    </span>
                                    <Link
                                        href={lotHref}
                                        target="_blank"
                                        className="px-1.5 py-0.5 rounded-md bg-white hover:bg-teal-100 text-teal-700 font-bold inline-flex items-center gap-0.5 border border-teal-200"
                                    >
                                        Xem LOT <ExternalLink size={10} />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleLotSummary(lotSum)}
                                        className="text-stone-400 hover:text-rose-600 font-bold ml-0.5"
                                        title="Gỡ liên kết"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB 1: Export Orders Picker (/work/export-order) */}
            {activeSourceTab === 'export_order' && (
                <div className="bg-white rounded-xl border border-indigo-200 p-3 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                            />
                            <input
                                type="text"
                                value={searchExportOrder}
                                onChange={e => setSearchExportOrder(e.target.value)}
                                placeholder="Tìm theo tên / mã Lệnh xuất kho (VD: đơn C hạt CUối, cont 3 c hạt)..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500"
                            />
                        </div>
                        <Link
                            href="/work/export-order"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở /work/export-order <ExternalLink size={11} />
                        </Link>
                    </div>

                    {loadingExportOrders ? (
                        <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                            <Loader2 size={15} className="animate-spin text-indigo-600" />
                            Đang tải danh sách Lệnh xuất kho...
                        </div>
                    ) : filteredExportOrders.length === 0 ? (
                        <div className="py-4 text-center text-xs text-stone-500">
                            Không tìm thấy lệnh xuất kho phù hợp.
                        </div>
                    ) : (
                        <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 border border-stone-100 rounded-lg">
                            {filteredExportOrders.map(ord => {
                                const isSelected = (value.linked_export_orders || []).some(
                                    o => o.id === ord.id
                                )
                                const dateShort = ord.created_at
                                    ? new Date(ord.created_at).toLocaleDateString('vi-VN')
                                    : ''
                                return (
                                    <div
                                        key={ord.id}
                                        onClick={() => handleToggleExportOrder(ord)}
                                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs ${
                                            isSelected
                                                ? 'bg-indigo-50/90 text-indigo-950'
                                                : 'hover:bg-stone-50 text-stone-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                                        : 'border-stone-300 bg-white'
                                                }`}
                                            >
                                                {isSelected && <Check size={11} />}
                                            </div>
                                            <div className="truncate">
                                                <span className="font-bold text-stone-900">
                                                    {ord.code}
                                                </span>
                                                <span className="ml-2 text-[11px] text-stone-400">
                                                    ({dateShort})
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                                📍 {ord.positions_count} vị trí
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                                📦 {ord.total_quantity.toLocaleString('vi-VN')}{' '}
                                                {ord.unit}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: Inbound Accounting Orders Picker (/inbound) */}
            {activeSourceTab === 'inbound' && (
                <div className="bg-white rounded-xl border border-emerald-200 p-3 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                            />
                            <input
                                type="text"
                                value={searchInbound}
                                onChange={e => setSearchInbound(e.target.value)}
                                placeholder="Tìm theo Mã phiếu nhập (PNK-...), nhà cung cấp, diễn giải..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-emerald-500"
                            />
                        </div>
                        <Link
                            href="/inbound"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở trang /inbound <ExternalLink size={11} />
                        </Link>
                    </div>

                    {loadingInbound ? (
                        <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                            <Loader2 size={15} className="animate-spin text-emerald-600" />
                            Đang tải danh sách Phiếu nhập kế toán...
                        </div>
                    ) : filteredInboundOrders.length === 0 ? (
                        <div className="py-4 text-center text-xs text-stone-500">
                            Không tìm thấy phiếu nhập kho kế toán phù hợp.
                        </div>
                    ) : (
                        <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 border border-stone-100 rounded-lg">
                            {filteredInboundOrders.map(ord => {
                                const isSelected = (value.linked_inbound_orders || []).some(
                                    o => o.id === ord.id
                                )
                                const dateShort = ord.created_at
                                    ? new Date(ord.created_at).toLocaleDateString('vi-VN')
                                    : ''
                                return (
                                    <div
                                        key={ord.id}
                                        onClick={() => handleToggleInboundOrder(ord)}
                                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs ${
                                            isSelected
                                                ? 'bg-emerald-50/90 text-emerald-950'
                                                : 'hover:bg-stone-50 text-stone-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                                        : 'border-stone-300 bg-white'
                                                }`}
                                            >
                                                {isSelected && <Check size={11} />}
                                            </div>
                                            <div className="truncate">
                                                <span className="font-bold text-stone-900">
                                                    {ord.code}
                                                </span>
                                                <span className="ml-1.5 text-[11px] text-stone-400">
                                                    ({dateShort})
                                                </span>
                                                {(ord.partner_name || ord.description) && (
                                                    <span className="ml-2 text-[11px] text-stone-500">
                                                        • {ord.partner_name || ord.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold">
                                                {ord.items_count} mặt hàng
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                                📥 {ord.total_quantity.toLocaleString('vi-VN')}{' '}
                                                {ord.unit}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: Outbound Accounting Orders Picker (/outbound) */}
            {activeSourceTab === 'outbound' && (
                <div className="bg-white rounded-xl border border-amber-200 p-3 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search
                                size={14}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                            />
                            <input
                                type="text"
                                value={searchOutbound}
                                onChange={e => setSearchOutbound(e.target.value)}
                                placeholder="Tìm theo Mã phiếu xuất (PXK-...), khách hàng, diễn giải..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-amber-500"
                            />
                        </div>
                        <Link
                            href="/outbound"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở trang /outbound <ExternalLink size={11} />
                        </Link>
                    </div>

                    {loadingOutbound ? (
                        <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                            <Loader2 size={15} className="animate-spin text-amber-600" />
                            Đang tải danh sách Phiếu xuất kế toán...
                        </div>
                    ) : filteredOutboundOrders.length === 0 ? (
                        <div className="py-4 text-center text-xs text-stone-500">
                            Không tìm thấy phiếu xuất kho kế toán phù hợp.
                        </div>
                    ) : (
                        <div className="max-h-52 overflow-y-auto divide-y divide-stone-100 border border-stone-100 rounded-lg">
                            {filteredOutboundOrders.map(ord => {
                                const isSelected = (value.linked_outbound_orders || []).some(
                                    o => o.id === ord.id
                                )
                                const dateShort = ord.created_at
                                    ? new Date(ord.created_at).toLocaleDateString('vi-VN')
                                    : ''
                                return (
                                    <div
                                        key={ord.id}
                                        onClick={() => handleToggleOutboundOrder(ord)}
                                        className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs ${
                                            isSelected
                                                ? 'bg-amber-50/90 text-amber-950'
                                                : 'hover:bg-stone-50 text-stone-700'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div
                                                className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                                    isSelected
                                                        ? 'bg-amber-600 border-amber-600 text-white'
                                                        : 'border-stone-300 bg-white'
                                                }`}
                                            >
                                                {isSelected && <Check size={11} />}
                                            </div>
                                            <div className="truncate">
                                                <span className="font-bold text-stone-900">
                                                    {ord.code}
                                                </span>
                                                <span className="ml-1.5 text-[11px] text-stone-400">
                                                    ({dateShort})
                                                </span>
                                                {(ord.partner_name || ord.description) && (
                                                    <span className="ml-2 text-[11px] text-stone-500">
                                                        • {ord.partner_name || ord.description}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 font-bold">
                                                {ord.items_count} mặt hàng
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                                📤 {ord.total_quantity.toLocaleString('vi-VN')}{' '}
                                                {ord.unit}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: LOTs Created by Date Picker (/warehouses/lots) */}
            {activeSourceTab === 'lots_by_date' && (
                <div className="bg-white rounded-xl border border-teal-200 p-3 space-y-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-teal-600" />
                            <span className="text-xs font-bold text-stone-700">
                                Ngày tạo LOT:
                            </span>
                            <input
                                type="date"
                                value={lotFilterDate}
                                onChange={e => setLotFilterDate(e.target.value)}
                                className="px-2.5 py-1 rounded-lg border border-stone-200 text-xs font-bold text-stone-800 outline-hidden focus:border-teal-500"
                            />
                        </div>
                        <Link
                            href={`/warehouses/lots?createdDate=${lotFilterDate}`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở /warehouses/lots (Ngày {formatVNDateSlash(lotFilterDate)}){' '}
                            <ExternalLink size={11} />
                        </Link>
                    </div>

                    {loadingLotSummaries ? (
                        <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                            <Loader2 size={15} className="animate-spin text-teal-600" />
                            Đang thống kê số LOT được tạo trong ngày{' '}
                            {formatVNDateSlash(lotFilterDate)}...
                        </div>
                    ) : lotDateSummaries.length === 0 ? (
                        <div className="py-4 text-center text-xs text-stone-500">
                            Không có LOT nào được tạo trong ngày{' '}
                            <b>{formatVNDateSlash(lotFilterDate)}</b> ở phân hệ này. Bạn có thể
                            đổi ngày tạo ở ô bên trên.
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            <div className="text-[11px] text-stone-500">
                                Chọn thống kê tổng tất cả kho hoặc theo từng Kho (KHO 1, KHO 2...)
                                để gắn làm bằng chứng khối lượng công việc:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {lotDateSummaries.map(sum => {
                                    const isSelected = (
                                        value.linked_lot_summaries || []
                                    ).some(s => s.id === sum.id)
                                    return (
                                        <div
                                            key={sum.id}
                                            onClick={() => handleToggleLotSummary(sum)}
                                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all text-xs ${
                                                isSelected
                                                    ? 'bg-teal-50 border-teal-400 text-teal-950 ring-1 ring-teal-400'
                                                    : 'bg-stone-50/70 hover:bg-stone-100 border-stone-200 text-stone-800'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div
                                                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                                        isSelected
                                                            ? 'bg-teal-600 border-teal-600 text-white'
                                                            : 'border-stone-300 bg-white'
                                                    }`}
                                                >
                                                    {isSelected && <Check size={11} />}
                                                </div>
                                                <div className="truncate">
                                                    <div className="font-extrabold">
                                                        🏷️ {sum.zone_name}
                                                    </div>
                                                    <div className="text-[10px] text-stone-500">
                                                        Ngày tạo:{' '}
                                                        {formatVNDateSlash(sum.created_date)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <span className="px-2 py-0.5 rounded-md bg-teal-100/80 text-teal-900 font-black">
                                                    {sum.lots_count} LOT
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-bold">
                                                    {sum.total_quantity.toLocaleString('vi-VN')}{' '}
                                                    {sum.unit}
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Quantitative Metrics Grid (Auto-filled from Linked Sources or Manual Entry) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <MapPin size={11} className="text-amber-600" />
                        Số Vị Trí Hạ/Xếp
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.positions_count ?? ''}
                        onChange={e => updateNumericField('positions_count', e.target.value)}
                        placeholder="VD: 52"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                    {value.quantity_factor &&
                        value.quantity_factor !== 1 &&
                        value.base_positions_count ? (
                        <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                            Gốc: {value.base_positions_count} ({value.quantity_factor_label})
                        </div>
                    ) : null}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <Boxes size={11} className="text-indigo-600" />
                        Số LOT / Pallet
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.lots_count ?? ''}
                        onChange={e => updateNumericField('lots_count', e.target.value)}
                        placeholder="VD: 52"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                    {value.quantity_factor &&
                        value.quantity_factor !== 1 &&
                        value.base_lots_count ? (
                        <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                            Gốc: {value.base_lots_count} ({value.quantity_factor_label})
                        </div>
                    ) : null}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <Package size={11} className="text-emerald-600" />
                        Số Thùng / Kiện
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.packages_count ?? ''}
                        onChange={e => updateNumericField('packages_count', e.target.value)}
                        placeholder="VD: 1560"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                    {value.quantity_factor &&
                        value.quantity_factor !== 1 &&
                        value.base_packages_count ? (
                        <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                            Gốc: {value.base_packages_count.toLocaleString('vi-VN')} (
                            {value.quantity_factor_label})
                        </div>
                    ) : null}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <Scale size={11} className="text-cyan-600" />
                        Khối Lượng (Kg)
                    </label>
                    <input
                        type="number"
                        min={0}
                        value={value.weight_kg ?? ''}
                        onChange={e => updateNumericField('weight_kg', e.target.value)}
                        placeholder="VD: 31200"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                    {value.quantity_factor &&
                        value.quantity_factor !== 1 &&
                        value.base_weight_kg ? (
                        <div className="text-[10px] font-semibold text-indigo-600 mt-0.5">
                            Gốc: {value.base_weight_kg.toLocaleString('vi-VN')} kg (
                            {value.quantity_factor_label})
                        </div>
                    ) : null}
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <Truck size={11} className="text-rose-600" />
                        Số Cont Xuất/Nhập
                    </label>
                    <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={value.containers_count ?? ''}
                        onChange={e => updateNumericField('containers_count', e.target.value)}
                        placeholder="VD: 1"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                    <label className="text-[10px] font-bold uppercase text-stone-500 flex items-center gap-1">
                        <Clock size={11} className="text-purple-600" />
                        Số Giờ Thực Hiện
                    </label>
                    <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={value.hours_spent ?? ''}
                        onChange={e =>
                            updateNumericField('hours_spent', e.target.value, false)
                        }
                        placeholder="VD: 3.5"
                        className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Quantity Multiplier / Fraction Adjustment Bar (1/3, 1/2, 2/3, x1, x1.5, x2, x3) + Clear Explanation Note */}
            <div className="bg-white rounded-xl border border-indigo-200/90 p-3 space-y-2.5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                        <span>🧮 Hệ số nhân / chia khối lượng thực tế:</span>
                        <span className="text-[11px] font-normal text-stone-500">
                            (VD: Đưa ra + đưa vào lại chọn <b>x2</b>; hàng đã bốc sẵn một phần chọn <b>1/3</b> hoặc <b>1/2</b>)
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {QUANTITY_FACTOR_PRESETS.map(preset => {
                        const currentFactor = value.quantity_factor || 1
                        const isActive =
                            Math.abs(currentFactor - preset.factor) < 0.01
                        return (
                            <button
                                key={preset.key}
                                type="button"
                                onClick={() => handleSelectQuantityFactor(preset)}
                                title={preset.description}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold transition-all ${
                                    isActive
                                        ? preset.factor === 1
                                            ? 'bg-stone-800 text-white border-stone-800 shadow-2xs'
                                            : 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30 shadow-2xs'
                                        : 'bg-stone-50 hover:bg-indigo-50 text-stone-700 border-stone-200'
                                }`}
                            >
                                {preset.label}
                            </button>
                        )
                    })}
                </div>

                {/* Adjustment Reason Input & Quick-Pick Reason Chips */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <span className="text-xs font-bold text-indigo-900 shrink-0">
                            📝 Lý do nhân / chia khối lượng:
                        </span>
                        <input
                            type="text"
                            value={value.quantity_adjustment_note || ''}
                            onChange={e =>
                                onChange({
                                    ...value,
                                    quantity_adjustment_note: e.target.value || null,
                                })
                            }
                            placeholder="VD: Đưa ra đưa vào nhân đôi khối lượng / Hôm đó làm 5 tấn nhưng có một số hàng đã được bốc sẵn..."
                            className="flex-1 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/30 text-xs font-semibold text-stone-800 outline-hidden focus:border-indigo-500 focus:bg-white"
                        />
                    </div>

                    {/* Quick reason chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-stone-400 uppercase">
                            Gợi ý nhanh:
                        </span>
                        {[
                            'Đưa ra đưa vào nhân đôi khối lượng (hạ ra dán tem/đai kiện rồi đưa vào lại kho)',
                            'Hôm đó có một số hàng đã được bốc sẵn từ trước (tính 1/3 khối lượng)',
                            'Một nửa lượng hàng đã được chuẩn bị sẵn từ ca trước (tính 1/2 khối lượng)',
                            'Chia khối lượng thực hiện cùng ca/nhóm khác',
                        ].map(reason => (
                            <button
                                key={reason}
                                type="button"
                                onClick={() =>
                                    onChange({
                                        ...value,
                                        quantity_adjustment_note: reason,
                                    })
                                }
                                className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-indigo-50 hover:text-indigo-700 text-stone-600 text-[11px] font-medium border border-stone-200 transition-colors text-left"
                            >
                                + {reason}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Custom Metric Note (For non-export tasks like cleaning, ice breaking, training) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <span className="text-xs font-bold text-stone-600 shrink-0">
                    Chỉ số khác (vệ sinh / đào tạo):
                </span>
                <input
                    type="text"
                    value={value.custom_metric_value || ''}
                    onChange={e =>
                        onChange({
                            ...value,
                            custom_metric_value: e.target.value || null,
                        })
                    }
                    placeholder="VD: Đập đá 3 dàn lạnh Kho 1, Quét dọn 500m² kho bao bì mới..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500"
                />
            </div>

            {/* Difficulty / Workload Weight Selector */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <Flame size={14} className="text-orange-600" />
                        Đánh giá Mức độ Nặng / Nhẹ của công việc (Hệ số quy đổi hiệu suất):
                    </label>
                    <button
                        type="button"
                        onClick={() =>
                            onChange({
                                ...value,
                                difficulty: suggestWorkloadDifficulty(value),
                            })
                        }
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                        <Sparkles size={12} />
                        Tự động gợi ý theo số liệu
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DIFFICULTY_KEYS.map(dKey => {
                        const cfg = DIFFICULTY_CONFIG[dKey]
                        const active = value.difficulty === dKey
                        return (
                            <button
                                key={dKey}
                                type="button"
                                onClick={() =>
                                    onChange({
                                        ...value,
                                        difficulty: active ? null : dKey,
                                    })
                                }
                                className={`p-2.5 rounded-xl border text-left transition-all ${
                                    active
                                        ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ring-2 ring-indigo-500/40 shadow-2xs`
                                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold">
                                        {cfg.badgeEmoji} {cfg.label}
                                    </span>
                                    <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-white/80 border border-current/15">
                                        x{cfg.multiplier}
                                    </span>
                                </div>
                                <div className="text-[10px] opacity-80 mt-0.5 line-clamp-1">
                                    {cfg.description}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
