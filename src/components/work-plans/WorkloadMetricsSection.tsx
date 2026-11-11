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
    ChevronRight,
    ChevronDown,
    ChevronUp,
    Database,
    Pencil,
    FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
    WorkloadMetrics,
    WorkloadDifficulty,
    LinkedExportOrderSummary,
    LinkedAccountingOrderSummary,
    LinkedLotDateSummary,
    LinkedApprovedAssignmentSummary,
    WorkPlanWorkNature,
    DIFFICULTY_CONFIG,
    QUANTITY_FACTOR_PRESETS,
    QuantityFactorPreset,
    parseUnitWeightKg,
    isKgUnit,
    suggestWorkloadDifficulty,
    recalculateWorkloadFromLinkedSources,
    applyQuantityFactorToMetrics,
    formatVNDateSlash,
} from './types'

function toDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function shiftDays(baseDateStr: string, offset: number): string {
    const d = new Date(`${baseDateStr}T00:00:00`)
    if (isNaN(d.getTime())) return baseDateStr
    d.setDate(d.getDate() + offset)
    return toDateStr(d)
}

interface WorkloadMetricsSectionProps {
    systemCode: string
    planDate: string
    value: WorkloadMetrics
    onChange: (next: WorkloadMetrics) => void
    defaultCollapsed?: boolean
    // Bản chất công việc: 'statistics' hiện thêm ô "Số phiếu / chứng từ đã tạo"
    workNature?: WorkPlanWorkNature | null
}

type ProofSourceTab =
    | 'export_order'
    | 'inbound'
    | 'outbound'
    | 'lots_by_date'
    | 'approved_assignments'
    | 'manual_entry'

const DIFFICULTY_KEYS: WorkloadDifficulty[] = ['light', 'medium', 'heavy', 'very_heavy']

// Quy đổi mặc định khi nhập tay (người dùng chốt: 1 pallet/vị trí/LOT = 600 kg, 1 thùng/kiện = 20 kg)
const MANUAL_KG_PER_PALLET = 600
const MANUAL_KG_PER_PACKAGE = 20

export default function WorkloadMetricsSection({
    systemCode,
    planDate,
    value,
    onChange,
    defaultCollapsed = true,
    workNature = 'labor',
}: WorkloadMetricsSectionProps) {
    const isStatistics = workNature === 'statistics'
    const [isExpanded, setIsExpanded] = useState<boolean>(!defaultCollapsed)
    const getInitialSourceTab = (): ProofSourceTab => {
        if ((value.linked_approved_assignments?.length || 0) > 0) return 'approved_assignments'
        if ((value.linked_export_orders?.length || 0) > 0) return 'export_order'
        if ((value.linked_lot_summaries?.length || 0) > 0) return 'lots_by_date'
        if ((value.linked_inbound_orders?.length || 0) > 0) return 'inbound'
        if ((value.linked_outbound_orders?.length || 0) > 0) return 'outbound'
        return 'manual_entry'
    }

    const [activeSourceTab, setActiveSourceTab] = useState<ProofSourceTab>(getInitialSourceTab)

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

    // 4. LOTs Created by Date (/warehouses/lots) - supports selecting arbitrary dates
    const [lotDates, setLotDates] = useState<string[]>([planDate])
    const [lotDateInput, setLotDateInput] = useState<string>(planDate)
    const [lotDateSummaries, setLotDateSummaries] = useState<LinkedLotDateSummary[]>([])
    const [loadingLotSummaries, setLoadingLotSummaries] = useState<boolean>(false)

    // 5. Approved Assignments (/production-lot/assignments) - supports selecting arbitrary dates
    const [assignDates, setAssignDates] = useState<string[]>([planDate])
    const [assignDateInput, setAssignDateInput] = useState<string>(planDate)
    const [assignSummaries, setAssignSummaries] = useState<LinkedApprovedAssignmentSummary[]>([])
    const [loadingAssignSummaries, setLoadingAssignSummaries] = useState<boolean>(false)

    useEffect(() => {
        if (planDate) {
            setLotDates(prev => (prev.length === 0 ? [planDate] : prev.includes(planDate) ? prev : [planDate]))
            setLotDateInput(planDate)
            setAssignDates(prev => (prev.length === 0 ? [planDate] : prev.includes(planDate) ? prev : [planDate]))
            setAssignDateInput(planDate)
        }
    }, [planDate])

    // Công việc Thống kê: đã gắn phiếu nhập/xuất kế toán thì tự điền số phiếu & số dòng dữ liệu khi ô còn trống
    useEffect(() => {
        if (!isStatistics) return
        const inbound = value.linked_inbound_orders || []
        const outbound = value.linked_outbound_orders || []
        const autoDocs = inbound.length + outbound.length
        const autoRows = [...inbound, ...outbound].reduce(
            (s, o) => s + (o.items_count || 0),
            0
        )
        const needsDocs = autoDocs > 0 && !(Number(value.documents_count) > 0)
        const needsRows = autoRows > 0 && !(Number(value.data_rows_count) > 0)
        if (needsDocs || needsRows) {
            onChange({
                ...value,
                documents_count: needsDocs ? autoDocs : value.documents_count ?? null,
                data_rows_count: needsRows ? autoRows : value.data_rows_count ?? null,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        isStatistics,
        value.linked_inbound_orders?.length,
        value.linked_outbound_orders?.length,
        value.documents_count,
        value.data_rows_count,
    ])

    const quickDatePills = useMemo(() => {
        const todayStr = toDateStr(new Date())
        const base = planDate || todayStr
        const set = new Set<string>()
        set.add(todayStr)
        set.add(base)
        for (let i = 0; i <= 6; i++) {
            set.add(shiftDays(todayStr, -i))
        }
        for (let i = -2; i <= 2; i++) {
            set.add(shiftDays(base, i))
        }
        const arr = Array.from(set).sort((a, b) => b.localeCompare(a))
        return arr.slice(0, 9).map(d => {
            const short = formatVNDateSlash(d).slice(0, 5)
            let note = ''
            if (d === todayStr) note = ' (Nay)'
            else if (d === shiftDays(todayStr, -1)) note = ' (Qua)'
            else if (d === planDate && d !== todayStr) note = ' (KH)'
            return {
                date: d,
                label: `${short}${note}`,
            }
        })
    }, [planDate])

    const handleToggleAssignDate = (dateStr: string) => {
        setAssignDates(prev => {
            if (prev.includes(dateStr)) {
                if (prev.length <= 1) return prev
                return prev.filter(d => d !== dateStr)
            }
            return [...prev, dateStr].sort()
        })
    }

    const handleAddAssignDate = (dateStr: string) => {
        if (!dateStr) return
        setAssignDates(prev => {
            if (prev.includes(dateStr)) return prev
            return [...prev, dateStr].sort()
        })
    }

    const handleRemoveAssignDate = (dateStr: string) => {
        setAssignDates(prev => {
            if (prev.length <= 1) return prev
            return prev.filter(d => d !== dateStr)
        })
    }

    const handleToggleLotDate = (dateStr: string) => {
        setLotDates(prev => {
            if (prev.includes(dateStr)) {
                if (prev.length <= 1) return prev
                return prev.filter(d => d !== dateStr)
            }
            return [...prev, dateStr].sort()
        })
    }

    const handleAddLotDate = (dateStr: string) => {
        if (!dateStr) return
        setLotDates(prev => {
            if (prev.includes(dateStr)) return prev
            return [...prev, dateStr].sort()
        })
    }

    const handleRemoveLotDate = (dateStr: string) => {
        setLotDates(prev => {
            if (prev.length <= 1) return prev
            return prev.filter(d => d !== dateStr)
        })
    }

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
                    let packageQty = 0
                    let kgQty = 0
                    let exportedQty = 0
                    let totalWeightKg = 0
                    const packageUnitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        if (it.position_id) posSet.add(it.position_id)
                        if (it.lot_id) lotSet.add(it.lot_id)
                        const q = Number(it.quantity) || 0
                        const eq = Number(it.exported_quantity) || 0
                        exportedQty += eq
                        const u = (it.unit || 'Thùng').trim()
                        if (isKgUnit(u)) {
                            kgQty += q
                            totalWeightKg += q
                        } else {
                            packageQty += q
                            const cleanU = u.replace(/\s*\([^)]*\)/g, '').trim() || 'Thùng'
                            packageUnitCounts[cleanU] = (packageUnitCounts[cleanU] || 0) + q
                            const wPerUnit = parseUnitWeightKg(u)
                            if (wPerUnit) {
                                totalWeightKg += q * wPerUnit
                            }
                        }
                    })

                    const dominantPackageUnit =
                        Object.entries(packageUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'
                    const dominantUnit = packageQty > 0 ? dominantPackageUnit : 'Kg'
                    const totalQty = packageQty > 0 ? packageQty : kgQty

                    return {
                        id: t.id,
                        code: t.code || 'Lệnh xuất',
                        status: t.status || 'Pending',
                        created_at: t.created_at,
                        positions_count: posSet.size || rawItems.length,
                        lots_count: lotSet.size || rawItems.length,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        packages_count: packageQty > 0 ? Math.round(packageQty * 100) / 100 : 0,
                        package_unit: packageQty > 0 ? dominantPackageUnit : null,
                        kg_quantity: kgQty > 0 ? Math.round(kgQty * 100) / 100 : null,
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
                    let packageQty = 0
                    let kgQty = 0
                    let totalWeightKg = 0
                    const packageUnitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        const q = Number(it.quantity) || 0
                        const u = (it.unit || 'Thùng').trim()
                        if (isKgUnit(u)) {
                            kgQty += q
                            totalWeightKg += q
                        } else {
                            packageQty += q
                            const cleanU = u.replace(/\s*\([^)]*\)/g, '').trim() || 'Thùng'
                            packageUnitCounts[cleanU] = (packageUnitCounts[cleanU] || 0) + q
                            const w = parseUnitWeightKg(u)
                            if (w) totalWeightKg += q * w
                        }
                    })

                    const dominantPackageUnit =
                        Object.entries(packageUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'
                    const dominantUnit = packageQty > 0 ? dominantPackageUnit : 'Kg'
                    const totalQty = packageQty > 0 ? packageQty : kgQty

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
                        packages_count: packageQty > 0 ? Math.round(packageQty * 100) / 100 : 0,
                        package_unit: packageQty > 0 ? dominantPackageUnit : null,
                        kg_quantity: kgQty > 0 ? Math.round(kgQty * 100) / 100 : null,
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
                    let packageQty = 0
                    let kgQty = 0
                    let totalWeightKg = 0
                    const packageUnitCounts: Record<string, number> = {}

                    rawItems.forEach((it: any) => {
                        const q = Number(it.quantity) || 0
                        const u = (it.unit || 'Thùng').trim()
                        if (isKgUnit(u)) {
                            kgQty += q
                            totalWeightKg += q
                        } else {
                            packageQty += q
                            const cleanU = u.replace(/\s*\([^)]*\)/g, '').trim() || 'Thùng'
                            packageUnitCounts[cleanU] = (packageUnitCounts[cleanU] || 0) + q
                            const w = parseUnitWeightKg(u)
                            if (w) totalWeightKg += q * w
                        }
                    })

                    const dominantPackageUnit =
                        Object.entries(packageUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'
                    const dominantUnit = packageQty > 0 ? dominantPackageUnit : 'Kg'
                    const totalQty = packageQty > 0 ? packageQty : kgQty

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
                        packages_count: packageQty > 0 ? Math.round(packageQty * 100) / 100 : 0,
                        package_unit: packageQty > 0 ? dominantPackageUnit : null,
                        kg_quantity: kgQty > 0 ? Math.round(kgQty * 100) / 100 : null,
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

    // Fetch LOTs Created by Date (/warehouses/lots) - supports arbitrary dates
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'lots_by_date' || lotDates.length === 0) return
        let cancelled = false

        const fetchLotsByDate = async () => {
            setLoadingLotSummaries(true)
            try {
                const [zonesRes, ...lotsResponses] = await Promise.all([
                    (supabase as any)
                        .from('zones')
                        .select('id, parent_id, name, code, level, display_order')
                        .eq('system_type', systemCode)
                        .order('level')
                        .order('display_order')
                        .order('name'),
                    ...lotDates.map(async (dStr) => {
                        const startIso = new Date(`${dStr}T00:00:00`).toISOString()
                        const endIso = new Date(`${dStr}T23:59:59.999`).toISOString()
                        const res = await (supabase as any)
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
                            .lte('created_at', endIso)
                        return res.data || []
                    }),
                ])

                if (cancelled) return

                const rawLots: any[] = lotsResponses.flat()
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

                const buildSummary = (
                    subset: any[],
                    zoneId: string | null,
                    zoneName: string,
                    customDateKey: string,
                    customDateLabel?: string
                ): LinkedLotDateSummary => {
                    let packageQty = 0
                    let kgQty = 0
                    let totalWeightKg = 0
                    let assignedPosCount = 0
                    const packageUnitCounts: Record<string, number> = {}

                    subset.forEach(l => {
                        const positions = Array.isArray(l.positions) ? l.positions : []
                        assignedPosCount += positions.length

                        const items = Array.isArray(l.lot_items) ? l.lot_items : []
                        if (items.length > 0) {
                            items.forEach((it: any) => {
                                const q = Number(it.quantity) || 0
                                const u = (it.unit || 'Thùng').trim()
                                if (isKgUnit(u)) {
                                    kgQty += q
                                    totalWeightKg += q
                                } else {
                                    packageQty += q
                                    const cleanU = u.replace(/\s*\([^)]*\)/g, '').trim() || 'Thùng'
                                    packageUnitCounts[cleanU] = (packageUnitCounts[cleanU] || 0) + q
                                    const w = parseUnitWeightKg(u)
                                    if (w) totalWeightKg += q * w
                                }
                            })
                        } else {
                            const q = Number(l.quantity) || 0
                            packageQty += q
                            packageUnitCounts['Thùng'] = (packageUnitCounts['Thùng'] || 0) + q
                        }
                    })

                    const dominantPackageUnit =
                        Object.entries(packageUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'
                    const dominantUnit = packageQty > 0 ? dominantPackageUnit : 'Kg'
                    const totalQty = packageQty > 0 ? packageQty : kgQty

                    return {
                        id: `${customDateKey}_${zoneId || 'ALL'}`,
                        created_date: customDateKey,
                        date_label: customDateLabel,
                        zone_id: zoneId,
                        zone_name: zoneName,
                        lots_count: subset.length,
                        assigned_positions_count: assignedPosCount,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        packages_count: packageQty > 0 ? Math.round(packageQty * 100) / 100 : 0,
                        package_unit: packageQty > 0 ? dominantPackageUnit : null,
                        kg_quantity: kgQty > 0 ? Math.round(kgQty * 100) / 100 : null,
                        unit: dominantUnit,
                        estimated_weight_kg:
                            totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                }

                const groupLotsByZone = (
                    subset: any[],
                    dateKey: string,
                    dateLabel?: string
                ): LinkedLotDateSummary[] => {
                    if (subset.length === 0) return []
                    return [buildSummary(subset, null, 'Tổng toàn kho', dateKey, dateLabel)]
                }

                const results: LinkedLotDateSummary[] = []

                if (rawLots.length > 0) {
                    if (lotDates.length > 1) {
                        // 1. Combined of all chosen dates
                        const sortedDates = [...lotDates].sort()
                        const combinedKey = sortedDates.join(',')
                        const combinedLabel = sortedDates
                            .map(d => formatVNDateSlash(d).slice(0, 5))
                            .join(' & ') + '/' + sortedDates[0].slice(0, 4)
                        results.push(...groupLotsByZone(rawLots, combinedKey, combinedLabel))

                        // 2. Individual Dates
                        const byDateMap = new Map<string, any[]>()
                        rawLots.forEach(l => {
                            let dStr = ''
                            if (l.created_at) {
                                const d = new Date(l.created_at)
                                if (!isNaN(d.getTime())) dStr = toDateStr(d)
                            }
                            if (!dStr) dStr = lotDates[0]
                            const arr = byDateMap.get(dStr) || []
                            arr.push(l)
                            byDateMap.set(dStr, arr)
                        })

                        const sortedUniqueDates = Array.from(byDateMap.keys()).sort((a, b) =>
                            b.localeCompare(a)
                        )
                        sortedUniqueDates.forEach(dStr => {
                            const sub = byDateMap.get(dStr) || []
                            results.push(...groupLotsByZone(sub, dStr, formatVNDateSlash(dStr)))
                        })
                    } else {
                        results.push(...groupLotsByZone(rawLots, lotDates[0], formatVNDateSlash(lotDates[0])))
                    }
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
    }, [systemCode, activeSourceTab, lotDates])

    // Fetch Approved Assignments by Date (/production-lot/assignments) - supports arbitrary dates
    useEffect(() => {
        if (!systemCode || activeSourceTab !== 'approved_assignments' || assignDates.length === 0)
            return
        let cancelled = false

        const fetchApprovedAssignments = async () => {
            setLoadingAssignSummaries(true)
            try {
                const [zonesRes, ...assignmentsResponses] = await Promise.all([
                    (supabase as any)
                        .from('zones')
                        .select('id, parent_id, name, code, level, display_order')
                        .eq('system_type', systemCode)
                        .order('level')
                        .order('display_order')
                        .order('name'),
                    ...assignDates.map(async (dStr) => {
                        const startIso = new Date(`${dStr}T00:00:00`).toISOString()
                        const endIso = new Date(`${dStr}T23:59:59.999`).toISOString()
                        const res = await (supabase as any)
                            .from('pending_assignments')
                            .select(
                                `
                                id,
                                lot_stt,
                                position_id,
                                production_date,
                                created_at,
                                status,
                                position:positions!pending_assignments_position_id_fkey(
                                    id,
                                    code,
                                    zone_positions(zone_id)
                                )
                            `
                            )
                            .eq('system_code', systemCode)
                            .ilike('status', 'approved%')
                            .gte('created_at', startIso)
                            .lte('created_at', endIso)
                        return res.data || []
                    }),
                ])

                if (cancelled) return

                const rawAssignments: any[] = assignmentsResponses.flat()
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

                // Extract lot_ids from status (approved:new:LOT_ID / approved:move:OLD:LOT_ID) and daily_seqs
                const knownLotIds: string[] = []
                const dailySeqs: number[] = []

                rawAssignments.forEach((a: any) => {
                    if (a.lot_stt) dailySeqs.push(a.lot_stt)
                    const parts = (a.status || '').split(':')
                    if (parts.length >= 3 && parts[0] === 'approved') {
                        const potentialId = parts[parts.length - 1]
                        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
                            knownLotIds.push(potentialId)
                        }
                    }
                })

                // Query lots information to calculate quantities and weights
                const uniqueLotIds = Array.from(new Set(knownLotIds))
                let lotsMap = new Map<string, any>()
                let lotsBySeqMap = new Map<number, any>()

                if (uniqueLotIds.length > 0) {
                    for (let i = 0; i < uniqueLotIds.length; i += 100) {
                        const chunk = uniqueLotIds.slice(i, i + 100)
                        const { data: lotsData } = await (supabase as any)
                            .from('lots')
                            .select('id, daily_seq, quantity, lot_items(quantity, unit)')
                            .in('id', chunk)
                        if (lotsData) {
                            lotsData.forEach((l: any) => {
                                lotsMap.set(l.id, l)
                                if (l.daily_seq) lotsBySeqMap.set(l.daily_seq, l)
                            })
                        }
                    }
                }

                if (dailySeqs.length > 0) {
                    const uniqueSeqs = Array.from(new Set(dailySeqs)).filter(s => !lotsBySeqMap.has(s))
                    if (uniqueSeqs.length > 0) {
                        for (let i = 0; i < uniqueSeqs.length; i += 100) {
                            const chunk = uniqueSeqs.slice(i, i + 100)
                            const { data: seqLotsData } = await (supabase as any)
                                .from('lots')
                                .select('id, daily_seq, quantity, lot_items(quantity, unit)')
                                .eq('system_code', systemCode)
                                .in('daily_seq', chunk)
                            if (seqLotsData) {
                                seqLotsData.forEach((l: any) => {
                                    lotsMap.set(l.id, l)
                                    if (l.daily_seq) lotsBySeqMap.set(l.daily_seq, l)
                                })
                            }
                        }
                    }
                }

                // Helper to build a LinkedApprovedAssignmentSummary from subset
                const buildAssignSummary = (
                    subset: any[],
                    zoneId: string | null,
                    zoneName: string,
                    customDateKey: string,
                    customDateLabel?: string
                ): LinkedApprovedAssignmentSummary => {
                    let packageQty = 0
                    let kgQty = 0
                    let totalWeightKg = 0
                    const packageUnitCounts: Record<string, number> = {}
                    const countedLotIds = new Set<string>()

                    subset.forEach(a => {
                        let matchedLot: any = null
                        const parts = (a.status || '').split(':')
                        if (parts.length >= 3 && parts[0] === 'approved') {
                            const potId = parts[parts.length - 1]
                            matchedLot = lotsMap.get(potId)
                        }
                        if (!matchedLot && a.lot_stt) {
                            matchedLot = lotsBySeqMap.get(a.lot_stt)
                        }

                        if (matchedLot) {
                            countedLotIds.add(matchedLot.id)
                            const items = Array.isArray(matchedLot.lot_items) ? matchedLot.lot_items : []
                            if (items.length > 0) {
                                items.forEach((it: any) => {
                                    const q = Number(it.quantity) || 0
                                    const u = (it.unit || 'Thùng').trim()
                                    if (isKgUnit(u)) {
                                        kgQty += q
                                        totalWeightKg += q
                                    } else {
                                        packageQty += q
                                        const cleanU = u.replace(/\s*\([^)]*\)/g, '').trim() || 'Thùng'
                                        packageUnitCounts[cleanU] = (packageUnitCounts[cleanU] || 0) + q
                                        const w = parseUnitWeightKg(u)
                                        if (w) totalWeightKg += q * w
                                    }
                                })
                            } else {
                                const q = Number(matchedLot.quantity) || 0
                                packageQty += q
                                packageUnitCounts['Thùng'] = (packageUnitCounts['Thùng'] || 0) + q
                            }
                        }
                    })

                    const dominantPackageUnit =
                        Object.entries(packageUnitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                        'Thùng'
                    const dominantUnit = packageQty > 0 ? dominantPackageUnit : 'Kg'
                    const totalQty = packageQty > 0 ? packageQty : kgQty

                    return {
                        id: `${customDateKey}_${zoneId || 'ALL'}`,
                        action_date: customDateKey,
                        date_label: customDateLabel,
                        zone_id: zoneId,
                        zone_name: zoneName,
                        approved_count: subset.length,
                        lots_count: countedLotIds.size || subset.length,
                        total_quantity: Math.round(totalQty * 100) / 100,
                        packages_count: packageQty > 0 ? Math.round(packageQty * 100) / 100 : 0,
                        package_unit: packageQty > 0 ? dominantPackageUnit : null,
                        kg_quantity: kgQty > 0 ? Math.round(kgQty * 100) / 100 : null,
                        unit: dominantUnit,
                        estimated_weight_kg: totalWeightKg > 0 ? Math.round(totalWeightKg) : null,
                    }
                }

                const groupAssignmentsByZone = (
                    subset: any[],
                    dateKey: string,
                    dateLabel?: string
                ): LinkedApprovedAssignmentSummary[] => {
                    if (subset.length === 0) return []
                    return [buildAssignSummary(subset, null, 'Tổng toàn kho', dateKey, dateLabel)]
                }

                const results: LinkedApprovedAssignmentSummary[] = []

                if (rawAssignments.length > 0) {
                    if (assignDates.length > 1) {
                        // 1. Combined of all chosen dates
                        const sortedDates = [...assignDates].sort()
                        const combinedKey = sortedDates.join(',')
                        const combinedLabel = sortedDates
                            .map(d => formatVNDateSlash(d).slice(0, 5))
                            .join(' & ') + '/' + sortedDates[0].slice(0, 4)
                        results.push(...groupAssignmentsByZone(rawAssignments, combinedKey, combinedLabel))

                        // 2. Individual Dates
                        const byDateMap = new Map<string, any[]>()
                        rawAssignments.forEach(a => {
                            let dStr = ''
                            if (a.created_at) {
                                const d = new Date(a.created_at)
                                if (!isNaN(d.getTime())) dStr = toDateStr(d)
                            }
                            if (!dStr) dStr = a.production_date || assignDates[0]
                            const arr = byDateMap.get(dStr) || []
                            arr.push(a)
                            byDateMap.set(dStr, arr)
                        })

                        const sortedUniqueDates = Array.from(byDateMap.keys()).sort((a, b) =>
                            b.localeCompare(a)
                        )
                        sortedUniqueDates.forEach(dStr => {
                            const sub = byDateMap.get(dStr) || []
                            results.push(...groupAssignmentsByZone(sub, dStr, formatVNDateSlash(dStr)))
                        })
                    } else {
                        results.push(...groupAssignmentsByZone(rawAssignments, assignDates[0], formatVNDateSlash(assignDates[0])))
                    }
                }

                setAssignSummaries(results)
            } catch (err) {
                console.error('Error loading approved assignments for workload:', err)
            } finally {
                if (!cancelled) setLoadingAssignSummaries(false)
            }
        }

        fetchApprovedAssignments()
        return () => {
            cancelled = true
        }
    }, [systemCode, activeSourceTab, assignDates])

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

    // Công việc Thống kê: số phiếu & số dòng dữ liệu lấy trực tiếp từ phiếu nhập + phiếu xuất kế toán đã gắn
    const syncStatisticsDocuments = (metrics: WorkloadMetrics): WorkloadMetrics => {
        if (!isStatistics) return metrics
        const inbound = metrics.linked_inbound_orders || []
        const outbound = metrics.linked_outbound_orders || []
        return {
            ...metrics,
            documents_count: inbound.length + outbound.length,
            data_rows_count: [...inbound, ...outbound].reduce(
                (s, o) => s + (o.items_count || 0),
                0
            ),
        }
    }

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
        onChange(syncStatisticsDocuments(nextMetrics))
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
        onChange(syncStatisticsDocuments(nextMetrics))
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

    const handleToggleApprovedAssignment = (summary: LinkedApprovedAssignmentSummary) => {
        const current = Array.isArray(value.linked_approved_assignments)
            ? value.linked_approved_assignments
            : []
        const exists = current.some(s => s.id === summary.id)
        const nextLinked = exists
            ? current.filter(s => s.id !== summary.id)
            : [...current, summary]

        const nextMetrics = recalculateWorkloadFromLinkedSources({
            ...value,
            linked_approved_assignments: nextLinked,
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

        // Nhập tay: tự quy đổi khối lượng từ số lượng (1 vị trí/LOT/pallet = 600 kg, 1 thùng/kiện = 20 kg)
        if (
            activeSourceTab === 'manual_entry' &&
            (field === 'positions_count' || field === 'lots_count' || field === 'packages_count')
        ) {
            const positionsCount = Number(next.positions_count) || 0
            const lotsCount = Number(next.lots_count) || 0
            const packagesCount = Number(next.packages_count) || 0
            let derivedKg: number | null = null
            if (field === 'packages_count') {
                if (packagesCount > 0) derivedKg = packagesCount * MANUAL_KG_PER_PACKAGE
            } else {
                const palletsCount = Math.max(positionsCount, lotsCount)
                if (palletsCount > 0) derivedKg = palletsCount * MANUAL_KG_PER_PALLET
            }
            if (derivedKg !== null) {
                const roundedKg = Math.round(derivedKg * 100) / 100
                next.weight_kg = roundedKg
                next.base_weight_kg = Math.round((roundedKg / currentFactor) * 100) / 100
            }
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
    const assignmentCount = value.linked_approved_assignments?.length || 0

    // Tổng số dòng dữ liệu của các phiếu nhập/xuất kế toán đã gắn
    const autoRowsCount = [
        ...(value.linked_inbound_orders || []),
        ...(value.linked_outbound_orders || []),
    ].reduce((s, o) => s + (o.items_count || 0), 0)

    const manualHasData =
        (Number(value.positions_count) || 0) > 0 ||
        (Number(value.lots_count) || 0) > 0 ||
        (Number(value.packages_count) || 0) > 0 ||
        (Number(value.weight_kg) || 0) > 0 ||
        (Number(value.containers_count) || 0) > 0 ||
        (Number(value.hours_spent) || 0) > 0 ||
        (Number(value.documents_count) || 0) > 0 ||
        (Number(value.data_rows_count) || 0) > 0

    const distinctSourcesCount =
        (exportCount > 0 ? 1 : 0) +
        (inboundCount > 0 ? 1 : 0) +
        (outboundCount > 0 ? 1 : 0) +
        (lotSummaryCount > 0 ? 1 : 0) +
        (assignmentCount > 0 ? 1 : 0)

    const hasAnyLinked = distinctSourcesCount > 0

    const proofSources = [
        {
            id: 'export_order' as const,
            title: 'Lệnh xuất kho',
            sub: '/work/export-order',
            icon: Package,
            iconColor: 'text-indigo-600',
            activeClass:
                'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200',
            badgeCount: exportCount,
            badgeActiveColor: 'bg-white text-indigo-700',
            badgeInactiveColor: 'bg-indigo-600 text-white',
        },
        {
            id: 'inbound' as const,
            title: 'Nhập kế toán',
            sub: '/inbound',
            icon: ArrowDownToLine,
            iconColor: 'text-emerald-600',
            activeClass:
                'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200',
            badgeCount: inboundCount,
            badgeActiveColor: 'bg-white text-emerald-700',
            badgeInactiveColor: 'bg-emerald-600 text-white',
        },
        {
            id: 'outbound' as const,
            title: 'Xuất kế toán',
            sub: '/outbound',
            icon: ArrowUpFromLine,
            iconColor: 'text-amber-600',
            activeClass:
                'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-200',
            badgeCount: outboundCount,
            badgeActiveColor: 'bg-white text-amber-700',
            badgeInactiveColor: 'bg-amber-600 text-white',
        },
        {
            id: 'lots_by_date' as const,
            title: 'Số LOT tạo',
            sub: '/warehouses/lots',
            icon: Layers,
            iconColor: 'text-teal-600',
            activeClass:
                'bg-teal-600 text-white border-teal-600 shadow-md ring-2 ring-teal-200',
            badgeCount: lotSummaryCount,
            badgeActiveColor: 'bg-white text-teal-700',
            badgeInactiveColor: 'bg-teal-600 text-white',
        },
        {
            id: 'approved_assignments' as const,
            title: 'Duyệt gán vị trí',
            sub: '/production-lot/assignments',
            icon: MapPin,
            iconColor: 'text-blue-600',
            activeClass:
                'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200',
            badgeCount: assignmentCount,
            badgeActiveColor: 'bg-white text-blue-700',
            badgeInactiveColor: 'bg-blue-600 text-white',
        },
        {
            id: 'manual_entry' as const,
            title: 'Nhập tay',
            sub: 'Không cần nguồn dữ liệu',
            icon: Pencil,
            iconColor: 'text-violet-600',
            activeClass:
                'bg-violet-600 text-white border-violet-600 shadow-md ring-2 ring-violet-200',
            badgeCount: 0,
            badgeActiveColor: 'bg-white text-violet-700',
            badgeInactiveColor: 'bg-violet-600 text-white',
        },
    ]

    const pos = Number(value.positions_count) || 0
    const conts = Number(value.containers_count) || 0
    const kg = Number(value.weight_kg) || 0
    const pkgs = Number(value.packages_count) || 0
    const docs = Number(value.documents_count) || 0

    const hasSummaryData =
        pos > 0 ||
        conts > 0 ||
        kg > 0 ||
        pkgs > 0 ||
        (Number(value.documents_count) || 0) > 0 ||
        (Number(value.data_rows_count) || 0) > 0 ||
        !!value.difficulty ||
        hasAnyLinked

    const manualMetricInputs = (
        <>
            {/* Quantitative Metrics Grid (Auto-filled from Linked Sources or Manual Entry) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                {isStatistics ? (
                    <div className="bg-white p-2.5 rounded-xl border border-sky-300 ring-1 ring-sky-100">
                        <label className="text-[10px] font-bold uppercase text-sky-700 flex items-center gap-1">
                            <FileText size={11} className="text-sky-600" />
                            Số Phiếu / Chứng Từ
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={value.documents_count ?? ''}
                            onChange={e =>
                                updateNumericField('documents_count', e.target.value, false)
                            }
                            placeholder="VD: 4"
                            className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-sky-500"
                        />
                        {inboundCount + outboundCount > 0 ? (
                            <div className="text-[10px] font-semibold text-sky-700 mt-0.5 leading-snug">
                                Tự động: {inboundCount} phiếu nhập + {outboundCount} phiếu xuất
                            </div>
                        ) : (
                            <div className="text-[10px] font-medium text-stone-500 mt-0.5 leading-snug">
                                Đếm phiếu đã hoàn thành trong ca
                            </div>
                        )}
                    </div>
                ) : (
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
                )}

                {isStatistics ? (
                    <div className="bg-white p-2.5 rounded-xl border border-sky-300 ring-1 ring-sky-100">
                        <label className="text-[10px] font-bold uppercase text-sky-700 flex items-center gap-1">
                            <FileText size={11} className="text-sky-600" />
                            Số Dòng Dữ Liệu
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={value.data_rows_count ?? ''}
                            onChange={e =>
                                updateNumericField('data_rows_count', e.target.value, false)
                            }
                            placeholder="VD: 40"
                            className="w-full mt-1 text-sm font-black text-stone-900 outline-hidden border-b border-transparent focus:border-sky-500"
                        />
                        {autoRowsCount > 0 ? (
                            <div className="text-[10px] font-semibold text-sky-700 mt-0.5 leading-snug">
                                Tự động: {autoRowsCount.toLocaleString('vi-VN')} dòng trong{' '}
                                {inboundCount + outboundCount} phiếu
                            </div>
                        ) : (
                            <div className="text-[10px] font-medium text-stone-500 mt-0.5 leading-snug">
                                Tổng dòng trong các phiếu đã nhập
                            </div>
                        )}
                    </div>
                ) : (
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
                )}

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
        </>
    )

    return (
        <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/30 p-3.5 sm:p-4 space-y-3.5 transition-all">
            {/* Header Accordion Bar (Bấm vào để mở rộng / thu gọn) */}
            <div
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex flex-wrap items-center justify-between gap-2.5 cursor-pointer select-none group/hdr"
                title={isExpanded ? 'Bấm để thu gọn phần số liệu chứng minh' : 'Bấm để mở rộng phần số liệu chứng minh'}
            >
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0 group-hover/hdr:bg-indigo-700 transition-colors">
                        <Scale size={15} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center flex-wrap gap-2">
                            <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-950 group-hover/hdr:text-indigo-700 transition-colors">
                                Số Liệu Chứng Minh Khối Lượng & Độ Nặng / Nhẹ
                            </h4>
                            {distinctSourcesCount > 1 && (
                                <span className="text-[10px] px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-extrabold shadow-2xs">
                                    Đã kết hợp {distinctSourcesCount} nguồn
                                </span>
                            )}
                        </div>
                        {isExpanded ? (
                            <p className="text-[11px] text-stone-500 line-clamp-1">
                                Gắn số liệu thực tế từ Lệnh xuất kho, Nhập/Xuất kế toán, Số LOT tạo, Duyệt gán vị trí xe nâng hoặc tự nhập tay
                            </p>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                                {hasSummaryData ? (
                                    <>
                                        <span className="text-stone-700 font-bold flex items-center gap-1">
                                            <span>📊 Đã gắn:</span>
                                            {conts > 0 && <b className="text-indigo-700">{conts} Cont</b>}
                                            {!isStatistics && pos > 0 && (
                                                <span>• <b className="text-indigo-700">{pos} vị trí</b></span>
                                            )}
                                            {kg > 0 && (
                                                <span>• <b className="text-indigo-700">{kg.toLocaleString('vi-VN')} kg</b></span>
                                            )}
                                            {pkgs > 0 && (
                                                <span>• <b>{pkgs} {value.package_unit || 'Thùng'}</b></span>
                                            )}
                                            {docs > 0 && (
                                                <span>• <b className="text-sky-700">📄 {docs.toLocaleString('vi-VN')} phiếu</b></span>
                                            )}
                                            {Number(value.data_rows_count) > 0 && (
                                                <span>• <b className="text-sky-700">📋 {Number(value.data_rows_count).toLocaleString('vi-VN')} dòng</b></span>
                                            )}
                                        </span>
                                        {value.difficulty && (
                                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                                {DIFFICULTY_CONFIG[value.difficulty]?.badgeEmoji} {DIFFICULTY_CONFIG[value.difficulty]?.label}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-stone-400 italic">
                                        Chưa gắn số liệu chứng minh (Bấm để mở rộng & chọn nguồn)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={e => {
                            e.stopPropagation()
                            setIsExpanded(prev => !prev)
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                            isExpanded
                                ? 'bg-white border-stone-300 text-stone-700 hover:bg-stone-50'
                                : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                    >
                        <span>{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>
            </div>

            {/* KHI MỞ RỘNG: HIỆN TOÀN BỘ NGUỒN DỮ LIỆU & CHI TIẾT */}
            {isExpanded && (
                <div className="space-y-4 pt-2 border-t border-indigo-100/70">
            {/* BỐ CỤC CHIA 2 CỘT THEO CHIỀU DỌC (Master - Detail) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
                {/* CỘT TRÁI (md:col-span-4 lg:col-span-3): DANH SÁCH NGUỒN THEO CHIỀU DỌC */}
                <div className="md:col-span-4 lg:col-span-3 space-y-2.5">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                            <Database size={13} className="text-indigo-600" />
                            Chọn nguồn dữ liệu
                        </span>
                        {hasAnyLinked && (
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                                {distinctSourcesCount} nguồn gắn
                            </span>
                        )}
                    </div>

                    {/* Danh sách 6 nguồn dữ liệu xếp dọc */}
                    <div className="flex flex-col gap-1.5">
                        {proofSources.map(src => {
                            const isActive = activeSourceTab === src.id
                            const Icon = src.icon
                            return (
                                <button
                                    key={src.id}
                                    type="button"
                                    onClick={() => setActiveSourceTab(src.id)}
                                    className={`w-full px-3 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                        isActive
                                            ? src.activeClass
                                            : src.badgeCount > 0
                                              ? 'bg-white text-stone-900 border-indigo-300 ring-1 ring-indigo-200/50 hover:bg-stone-50'
                                              : 'bg-white/80 text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                isActive
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-stone-100 ' + src.iconColor
                                            }`}
                                        >
                                            <Icon size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-black truncate leading-tight">
                                                {src.title}
                                            </div>
                                            <div
                                                className={`text-[10px] truncate ${
                                                    isActive ? 'text-white/80' : 'text-stone-400'
                                                }`}
                                            >
                                                {src.sub}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {src.badgeCount > 0 && (
                                            <span
                                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                    isActive
                                                        ? src.badgeActiveColor
                                                        : src.badgeInactiveColor
                                                }`}
                                            >
                                                {src.badgeCount}
                                            </span>
                                        )}
                                        {src.id === 'manual_entry' && manualHasData && (
                                            <span
                                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                    isActive
                                                        ? 'bg-white text-violet-700'
                                                        : 'bg-violet-600 text-white'
                                                }`}
                                                title="Đã nhập số liệu tay"
                                            >
                                                ✓
                                            </span>
                                        )}
                                        <ChevronRight
                                            size={14}
                                            className={`transition-transform ${
                                                isActive
                                                    ? 'text-white translate-x-0.5'
                                                    : 'text-stone-300'
                                            }`}
                                        />
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Mẹo cộng dồn nguồn */}
                    <div className="p-2.5 rounded-xl bg-white/70 border border-stone-200/70 text-[11px] text-stone-600 space-y-1">
                        <div className="font-extrabold text-stone-800 flex items-center gap-1">
                            <span>💡 Mẹo cộng dồn:</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-stone-500">
                            Bạn có thể chọn mục ở nguồn này, sau đó click chọn tiếp nguồn khác bên trái để cộng dồn thêm số liệu.
                        </p>
                        <p className="text-[10px] leading-relaxed text-stone-500">
                            Không có chứng từ? Chọn <b>Nhập tay</b> để nhập số liệu trực tiếp.
                        </p>
                    </div>
                </div>

                {/* CỘT PHẢI (md:col-span-8 lg:col-span-9): CHI TIẾT & BẢNG CHỌN NGUỒN ĐANG ACTIVE */}
                <div className="md:col-span-8 lg:col-span-9 space-y-3 min-w-0">

            {/* Active Linked Proof Badges (All 5 Sources) */}
            {(exportCount > 0 ||
                inboundCount > 0 ||
                outboundCount > 0 ||
                lotSummaryCount > 0 ||
                assignmentCount > 0) && (
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
                                        {lotSum.date_label || formatVNDateSlash(lotSum.created_date)}
                                    </span>
                                    <span className="text-stone-600 font-semibold">
                                        {lotSum.assigned_positions_count > 0 && (
                                            <>
                                                • <b>{lotSum.assigned_positions_count}</b> vị trí
                                            </>
                                        )}
                                        {(lotSum.packages_count ?? 0) > 0 && (
                                            <>
                                                {' '}•{' '}
                                                <b>
                                                    {lotSum.packages_count?.toLocaleString('vi-VN')}
                                                </b>{' '}
                                                {lotSum.package_unit || 'Thùng'}
                                            </>
                                        )}
                                        {lotSum.estimated_weight_kg && lotSum.estimated_weight_kg > 0 && (
                                            <>
                                                {' '}•{' '}
                                                <b>
                                                    {lotSum.estimated_weight_kg.toLocaleString('vi-VN')}
                                                </b>{' '}
                                                kg
                                            </>
                                        )}
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
                        {/* 5. Linked Approved Assignments */}
                        {(value.linked_approved_assignments || []).map(assignSum => {
                            const assignHref = `/production-lot/assignments`
                            return (
                                <div
                                    key={`assign_${assignSum.id}`}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50/90 border border-blue-200 text-xs"
                                >
                                    <span className="font-extrabold text-blue-800">
                                        🚜 {assignSum.approved_count} vị trí duyệt lên kệ (
                                        {assignSum.date_label || formatVNDateSlash(assignSum.action_date)})
                                    </span>
                                    <span className="text-stone-600 font-semibold">
                                        • <b>{assignSum.lots_count}</b> LOT
                                        {(assignSum.packages_count ?? 0) > 0 && (
                                            <>
                                                {' '}•{' '}
                                                <b>
                                                    {assignSum.packages_count?.toLocaleString(
                                                        'vi-VN'
                                                    )}
                                                </b>{' '}
                                                {assignSum.package_unit || 'Thùng'}
                                            </>
                                        )}
                                        {assignSum.estimated_weight_kg &&
                                            assignSum.estimated_weight_kg > 0 && (
                                                <>
                                                    {' '}•{' '}
                                                    <b>
                                                        {assignSum.estimated_weight_kg.toLocaleString(
                                                            'vi-VN'
                                                        )}
                                                    </b>{' '}
                                                    kg
                                                </>
                                            )}
                                    </span>
                                    <Link
                                        href={assignHref}
                                        target="_blank"
                                        className="px-1.5 py-0.5 rounded-md bg-white hover:bg-blue-100 text-blue-700 font-bold inline-flex items-center gap-0.5 border border-blue-200"
                                    >
                                        Xem duyệt <ExternalLink size={10} />
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleApprovedAssignment(assignSum)}
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
                    <div className="flex items-center justify-between pb-1.5 border-b border-indigo-100">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                                📦 Bảng chọn: Lệnh xuất kho (/work/export-order)
                            </span>
                        </div>
                        <Link
                            href="/work/export-order"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở /work/export-order <ExternalLink size={11} />
                        </Link>
                    </div>
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
                    <div className="flex items-center justify-between pb-1.5 border-b border-emerald-100">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                                📥 Bảng chọn: Phiếu nhập kế toán (/inbound)
                            </span>
                        </div>
                        <Link
                            href="/inbound"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở trang /inbound <ExternalLink size={11} />
                        </Link>
                    </div>
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
                    </div>

                    <p className="text-[11px] text-emerald-900 bg-emerald-50/60 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                        ℹ️ Phiếu nhập kế toán không có thông tin LOT / vị trí thật — số LOT/Pallet và Số vị trí để trống, bạn tự nhập ở các ô bên dưới nếu cần.
                    </p>

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
                    <div className="flex items-center justify-between pb-1.5 border-b border-amber-100">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                            <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                                📤 Bảng chọn: Phiếu xuất kế toán (/outbound)
                            </span>
                        </div>
                        <Link
                            href="/outbound"
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold inline-flex items-center gap-1"
                        >
                            Mở trang /outbound <ExternalLink size={11} />
                        </Link>
                    </div>
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
                    </div>

                    <p className="text-[11px] text-amber-900 bg-amber-50/60 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        ℹ️ Phiếu xuất kế toán không có thông tin LOT / vị trí thật — số LOT/Pallet và Số vị trí để trống, bạn tự nhập ở các ô bên dưới nếu cần.
                    </p>

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

            {/* TAB 4: LOTs Created by Date Picker (/warehouses/lots) - Supports Selecting Arbitrary Multiple Dates */}
            {activeSourceTab === 'lots_by_date' && (() => {
                const isMulti = lotDates.length > 1
                const rangeItems = lotDateSummaries.filter(s => s.created_date.includes(','))
                const dailyItems = lotDateSummaries.filter(s => !s.created_date.includes(','))

                const renderLotCard = (sum: LinkedLotDateSummary) => {
                    const isSelected = (value.linked_lot_summaries || []).some(
                        s => s.id === sum.id
                    )
                    const isCombined = sum.created_date.includes(',')
                    return (
                        <div
                            key={sum.id}
                            onClick={() => handleToggleLotSummary(sum)}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all text-xs ${
                                isSelected
                                    ? 'bg-teal-50 border-teal-400 text-teal-950 ring-1 ring-teal-400 shadow-2xs'
                                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
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
                                    <div className="font-extrabold flex items-center gap-1.5 text-teal-950">
                                        <span>📚 {isCombined ? `Gộp cả đợt (${sum.date_label || 'nhiều ngày'})` : `Ngày ${sum.date_label || formatVNDateSlash(sum.created_date)}`}</span>
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                                            Số tổng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">
                                        Toàn bộ các kho cộng dồn
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded-md bg-teal-100/90 text-teal-900 font-black">
                                    🏷️ {sum.lots_count} LOT
                                </span>
                                {sum.assigned_positions_count > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[10px]">
                                        📍 {sum.assigned_positions_count} vị trí
                                    </span>
                                )}
                                {(sum.packages_count ?? 0) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[10px]">
                                        📦 {sum.packages_count?.toLocaleString('vi-VN')} {sum.package_unit || 'Thùng'}
                                    </span>
                                )}
                                {sum.estimated_weight_kg && sum.estimated_weight_kg > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                        ⚖️ {sum.estimated_weight_kg.toLocaleString('vi-VN')} kg
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                }

                return (
                    <div className="bg-white rounded-xl border border-teal-200 p-3 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-teal-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                                <span className="text-xs font-black text-teal-950 uppercase tracking-wider">
                                    📚 Bảng chọn: Số LOT tạo theo ngày (/warehouses/lots)
                                </span>
                            </div>
                        </div>

                        {/* Header & Date Selector Bar */}
                        <div className="space-y-2 pb-1 border-b border-stone-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                                    <Calendar size={14} className="text-teal-600" />
                                    <span>Tùy chọn các ngày tạo LOT (Chọn nhiều ngày bất kỳ):</span>
                                </div>

                                <Link
                                    href="/warehouses/lots"
                                    target="_blank"
                                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold inline-flex items-center gap-1 shrink-0"
                                >
                                    Mở /warehouses/lots <ExternalLink size={11} />
                                </Link>
                            </div>

                            {/* Quick Toggle Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-stone-500 mr-0.5">Bấm chọn nhanh:</span>
                                {quickDatePills.map(p => {
                                    const isSelected = lotDates.includes(p.date)
                                    return (
                                        <button
                                            key={p.date}
                                            type="button"
                                            onClick={() => handleToggleLotDate(p.date)}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border transition-all inline-flex items-center gap-1 ${
                                                isSelected
                                                    ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                                    : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                                            }`}
                                        >
                                            {isSelected && <Check size={11} />}
                                            <span>{p.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Active Dates Chips & Date Input Adder */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-stone-600">
                                        Đã chọn ({lotDates.length} ngày):
                                    </span>
                                    {[...lotDates].sort().map(d => (
                                        <span
                                            key={d}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-xs font-black"
                                        >
                                            <span>{formatVNDateSlash(d)}</span>
                                            {lotDates.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLotDate(d)}
                                                    className="text-teal-400 hover:text-rose-600 font-bold ml-0.5"
                                                    title="Bỏ ngày này"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1 ml-auto">
                                    <input
                                        type="date"
                                        value={lotDateInput}
                                        onChange={e => setLotDateInput(e.target.value)}
                                        className="px-2 py-0.5 rounded border border-stone-200 text-xs font-bold text-stone-800 outline-hidden focus:border-teal-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddLotDate(lotDateInput)}
                                        className="px-2.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition-colors"
                                    >
                                        + Thêm ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingLotSummaries ? (
                            <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                                <Loader2 size={15} className="animate-spin text-teal-600" />
                                Đang thống kê số LOT tạo cho {lotDates.length} ngày đã chọn...
                            </div>
                        ) : lotDateSummaries.length === 0 ? (
                            <div className="py-4 text-center text-xs text-stone-500">
                                Không có LOT nào được tạo trong các ngày đã chọn ở phân hệ này.
                            </div>
                        ) : isMulti ? (
                            <div className="space-y-3">
                                {rangeItems.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-teal-900 uppercase flex items-center gap-1.5">
                                                <span>
                                                    📊 Gộp toàn bộ {lotDates.length} ngày đã chọn ({[...lotDates].sort().map(d => formatVNDateSlash(d).slice(0, 5)).join(' & ')})
                                                </span>
                                            </span>
                                            <span className="text-[10px] text-teal-700 font-semibold bg-teal-100/70 px-2 py-0.5 rounded-full">
                                                Chọn nhanh cả đợt
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {rangeItems.map(sum => renderLotCard(sum))}
                                        </div>
                                    </div>
                                )}

                                {dailyItems.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[11px] font-extrabold uppercase text-stone-600 flex items-center gap-1">
                                            <Calendar size={12} className="text-teal-600" />
                                            <span>Số tổng theo từng ngày (Tích chọn để cộng dồn):</span>
                                        </div>
                                        <div className="space-y-2">
                                            {dailyItems.map(sum => renderLotCard(sum))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="text-[11px] text-stone-500">
                                    Số tổng LOT tạo ngày <b>{formatVNDateSlash(lotDates[0])}</b> (toàn kho):
                                </div>
                                <div className="space-y-2">
                                    {lotDateSummaries.map(sum => renderLotCard(sum))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* TAB 5: Approved Assignments Picker (/production-lot/assignments) - Supports Selecting Arbitrary Multiple Dates */}
            {activeSourceTab === 'approved_assignments' && (() => {
                const isMulti = assignDates.length > 1
                const rangeItems = assignSummaries.filter(s => s.action_date.includes(','))
                const dailyItems = assignSummaries.filter(s => !s.action_date.includes(','))

                const renderAssignCard = (sum: LinkedApprovedAssignmentSummary) => {
                    const isSelected = (value.linked_approved_assignments || []).some(
                        s => s.id === sum.id
                    )
                    const isCombined = sum.action_date.includes(',')
                    return (
                        <div
                            key={sum.id}
                            onClick={() => handleToggleApprovedAssignment(sum)}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all text-xs ${
                                isSelected
                                    ? 'bg-blue-50 border-blue-400 text-blue-950 ring-1 ring-blue-400 shadow-2xs'
                                    : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${
                                        isSelected
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'border-stone-300 bg-white'
                                    }`}
                                >
                                    {isSelected && <Check size={11} />}
                                </div>
                                <div className="truncate">
                                    <div className="font-extrabold flex items-center gap-1.5 text-blue-950">
                                        <span>🚜 {isCombined ? `Gộp cả đợt (${sum.date_label || 'nhiều ngày'})` : `Ngày ${sum.date_label || formatVNDateSlash(sum.action_date)}`}</span>
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                            Số tổng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">
                                        Toàn bộ các kho cộng dồn
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded-md bg-blue-100/90 text-blue-900 font-black">
                                    📍 {sum.approved_count} vị trí
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-700 font-bold text-[10px]">
                                    🏷️ {sum.lots_count} LOT
                                </span>
                                {(sum.packages_count ?? 0) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[10px]">
                                        📦 {sum.packages_count?.toLocaleString('vi-VN')} {sum.package_unit || 'Thùng'}
                                    </span>
                                )}
                                {sum.estimated_weight_kg && sum.estimated_weight_kg > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                        ⚖️ {sum.estimated_weight_kg.toLocaleString('vi-VN')} kg
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                }

                return (
                    <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-blue-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                <span className="text-xs font-black text-blue-950 uppercase tracking-wider">
                                    🚜 Bảng chọn: Duyệt gán vị trí xe nâng (/production-lot/assignments)
                                </span>
                            </div>
                        </div>

                        {/* Header & Date Selector Bar */}
                        <div className="space-y-2 pb-1 border-b border-stone-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                                    <Calendar size={14} className="text-blue-600" />
                                    <span>Tùy chọn các ngày duyệt lên kệ (Chọn nhiều ngày bất kỳ):</span>
                                </div>

                                <Link
                                    href="/production-lot/assignments"
                                    target="_blank"
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold inline-flex items-center gap-1 shrink-0"
                                >
                                    Mở /production-lot/assignments <ExternalLink size={11} />
                                </Link>
                            </div>

                            {/* Quick Toggle Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-stone-500 mr-0.5">Bấm chọn nhanh:</span>
                                {quickDatePills.map(p => {
                                    const isSelected = assignDates.includes(p.date)
                                    return (
                                        <button
                                            key={p.date}
                                            type="button"
                                            onClick={() => handleToggleAssignDate(p.date)}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border transition-all inline-flex items-center gap-1 ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                    : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                                            }`}
                                        >
                                            {isSelected && <Check size={11} />}
                                            <span>{p.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Active Dates Chips & Date Input Adder */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-stone-600">
                                        Đã chọn ({assignDates.length} ngày):
                                    </span>
                                    {[...assignDates].sort().map(d => (
                                        <span
                                            key={d}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-xs font-black"
                                        >
                                            <span>{formatVNDateSlash(d)}</span>
                                            {assignDates.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAssignDate(d)}
                                                    className="text-blue-400 hover:text-rose-600 font-bold ml-0.5"
                                                    title="Bỏ ngày này"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1 ml-auto">
                                    <input
                                        type="date"
                                        value={assignDateInput}
                                        onChange={e => setAssignDateInput(e.target.value)}
                                        className="px-2 py-0.5 rounded border border-stone-200 text-xs font-bold text-stone-800 outline-hidden focus:border-blue-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddAssignDate(assignDateInput)}
                                        className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors"
                                    >
                                        + Thêm ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingAssignSummaries ? (
                            <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                                <Loader2 size={15} className="animate-spin text-blue-600" />
                                Đang tổng hợp vị trí xe nâng cho {assignDates.length} ngày đã chọn...
                            </div>
                        ) : assignSummaries.length === 0 ? (
                            <div className="py-4 text-center text-xs text-stone-500">
                                Không có bản ghi gán vị trí nào được duyệt trong các ngày đã chọn ở phân hệ này.
                            </div>
                        ) : isMulti ? (
                            <div className="space-y-3">
                                {rangeItems.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
                                                <span>
                                                    📊 Gộp toàn bộ {assignDates.length} ngày đã chọn ({[...assignDates].sort().map(d => formatVNDateSlash(d).slice(0, 5)).join(' & ')})
                                                </span>
                                            </span>
                                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
                                                Chọn nhanh cả đợt
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {rangeItems.map(sum => renderAssignCard(sum))}
                                        </div>
                                    </div>
                                )}

                                {dailyItems.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[11px] font-extrabold uppercase text-stone-600 flex items-center gap-1">
                                            <Calendar size={12} className="text-blue-600" />
                                            <span>Số tổng theo từng ngày (Tích chọn để cộng dồn):</span>
                                        </div>
                                        <div className="space-y-2">
                                            {dailyItems.map(sum => renderAssignCard(sum))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="text-[11px] text-stone-500">
                                    Số tổng vị trí xe nâng đã đưa lên kệ ngày <b>{formatVNDateSlash(assignDates[0])}</b> (toàn kho):
                                </div>
                                <div className="space-y-2">
                                    {assignSummaries.map(sum => renderAssignCard(sum))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* TAB 6: Manual Entry (Tự nhập số liệu khi không có nguồn dữ liệu cụ thể) */}
            {activeSourceTab === 'manual_entry' && (
                <div className="bg-white rounded-xl border border-violet-200 p-3 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-violet-100">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                            <span className="text-xs font-black text-violet-950 uppercase tracking-wider">
                                ✍️ Bảng nhập tay số liệu chứng minh
                            </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                            Không cần chứng từ / nguồn dữ liệu
                        </span>
                    </div>

                    {isStatistics ? (
                        <p className="text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                            📊 Công việc <b>Thống kê / Ghi chép</b>: nhập <b>Số phiếu / chứng từ</b> và <b>Số dòng dữ liệu</b>
                            (tổng số dòng đã nhập trong các phiếu) để chấm độ chính xác và hoàn thành trong ngày. Bước
                            Báo cáo & Xếp hạng <b>không ghi sản lượng và giờ làm</b> cho việc này.
                        </p>
                    ) : (
                        <>
                            <p className="text-[11px] text-stone-500 leading-relaxed">
                                Nhập trực tiếp số liệu thực tế đã thực hiện (vị trí hạ/xếp, LOT/pallet, thùng/kiện, khối lượng, cont, số giờ).
                                Số liệu nhập tay được dùng ngay để tính độ nặng / nhẹ và phân bổ hiệu suất cho công việc.
                            </p>
                            <p className="text-[11px] font-semibold text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5">
                                ⚖️ Tự quy đổi khối lượng theo ô vừa nhập: 1 vị trí / LOT / pallet = <b>600 kg</b>; 1 thùng / kiện = <b>20 kg</b>.
                                Nhập tay trực tiếp ô Khối lượng nếu muốn giá trị khác.
                            </p>
                        </>
                    )}

                    {manualMetricInputs}
                </div>
            )}
                </div>
            </div>

            {activeSourceTab !== 'manual_entry' && manualMetricInputs}

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
                                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-white/80 border border-current/15">
                                        {cfg.baseScore}đ (x{cfg.multiplier})
                                    </span>
                                </div>
                                <div className="text-[10px] opacity-80 mt-1 line-clamp-2 leading-tight">
                                    {cfg.description}
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
                </div>
            )}
        </div>
    )
}
