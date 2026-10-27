'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    Loader2,
    Search,
    Download,
    CalendarDays,
    RefreshCw,
    Package,
    FileStack,
    Boxes,
    TrendingDown,
    Clock3,
    BarChart3,
} from 'lucide-react'
import { format, subDays, startOfMonth } from 'date-fns'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import { exportOrderReportToExcel } from '@/lib/exportOrderReportExcelExport'

const FETCH_PAGE_SIZE = 1000
const ROW_PAGE_SIZE = 50

const TASK_STATUS_LABELS: Record<string, string> = {
    Pending: 'Chờ xử lý',
    'In Progress': 'Đang xử lý',
    Picked: 'Đã lấy hàng',
    Completed: 'Hoàn thành',
    Cancelled: 'Đã hủy',
}

type GroupMode = 'DAY' | 'PRODUCT' | 'TASK' | 'HOUR'

interface StatItemRow {
    taskCode: string
    taskStatus: string
    taskCreatedAt: string
    productName: string
    sku: string
    productionCode: string | null
    lotCode: string
    positionCode: string
    quantity: number
    exportedQuantity: number
    unit: string
    lineStatus: string
    taskNotes: string
    day: string
}

interface StatPickRow {
    createdAt: string
    day: string
    hour: string
    pickerName: string
    productName: string
    sku: string
    taskCode: string
    quantity: number
    unit: string
    note: string
}

interface DayGroup {
    day: string
    taskCodes: Set<string>
    completedTaskCodes: Set<string>
    lineCount: number
    requestedQty: number
    exportedQty: number
    pickQty: number
}

interface ProductGroup {
    key: string
    productName: string
    sku: string
    unit: string
    lineCount: number
    requestedQty: number
    exportedQty: number
}

interface HourGroup {
    key: string
    day: string
    hour: string
    pickCount: number
    pickers: Set<string>
    quantity: number
    unit: string
}

interface TaskGroup {
    taskCode: string
    taskStatus: string
    taskCreatedAt: string
    lineCount: number
    skuCount: number
    doneLineCount: number
    requestedQty: number
    exportedQty: number
    products: Set<string>
    notes: string
}

interface DetailCell {
    label: string
    value: string
    title?: string
    truncate?: boolean
    strong?: boolean
}

interface DetailRow {
    id: string
    numericFrom: number
    cells: DetailCell[]
}

export default function ExportOrderStatsPanel({ active }: { active: boolean }) {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 6), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [searchTerm, setSearchTerm] = useState('')
    const [groupMode, setGroupMode] = useState<GroupMode>('DAY')
    const [page, setPage] = useState(1)

    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [itemRows, setItemRows] = useState<StatItemRow[]>([])
    const [pickRows, setPickRows] = useState<StatPickRow[]>([])
    const [fetchedAt, setFetchedAt] = useState<Date | null>(null)

    const fetchData = useCallback(async () => {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString()
            const toIso = new Date(`${dateTo}T23:59:59.999`).toISOString()

            // 1. Dòng lệnh xuất (theo ngày tạo lệnh)
            const allItems: StatItemRow[] = []
            let from = 0
            let hasMore = true
            while (hasMore) {
                let query = supabase
                    .from('export_task_items')
                    .select(`
                        id,
                        quantity,
                        exported_quantity,
                        unit,
                        status,
                        export_tasks!inner(code, status, notes, created_at, system_code),
                        products(name, sku),
                        lots(code, production_code),
                        positions(code)
                    `)
                    .eq('export_tasks.system_code', currentSystem.code)
                    .gte('export_tasks.created_at', fromIso)
                    .lte('export_tasks.created_at', toIso)
                    .order('created_at', { ascending: false })
                    .range(from, from + FETCH_PAGE_SIZE - 1)

                const { data, error } = await query
                if (error) throw error
                const rows = (data || []) as any[]
                rows.forEach((r: any) => {
                    const task = Array.isArray(r.export_tasks) ? r.export_tasks[0] : r.export_tasks
                    allItems.push({
                        taskCode: task?.code || 'N/A',
                        taskStatus: task?.status || 'N/A',
                        taskCreatedAt: task?.created_at || '',
                        productName: r.products?.name || 'N/A',
                        sku: r.products?.sku || '',
                        productionCode: r.lots?.production_code || null,
                        lotCode: r.lots?.code || 'N/A',
                        positionCode: r.positions?.code || 'N/A',
                        quantity: Number(r.quantity) || 0,
                        exportedQuantity: Number(r.exported_quantity) || 0,
                        unit: r.unit || '',
                        lineStatus: r.status || 'N/A',
                        taskNotes: task?.notes || '',
                        day: task?.created_at ? format(new Date(task.created_at), 'yyyy-MM-dd') : '',
                    })
                })
                if (rows.length < FETCH_PAGE_SIZE) hasMore = false
                else from += FETCH_PAGE_SIZE
            }
            setItemRows(allItems)

            // 2. Lượt hạ hàng (theo thời điểm hạ thực tế)
            const allPicks: StatPickRow[] = []
            try {
                let pFrom = 0
                let pHasMore = true
                while (pHasMore) {
                    const { data, error } = await supabase
                        .from('export_task_picks')
                        .select(`
                            id,
                            quantity,
                            note,
                            created_at,
                            picker:user_profiles!picker_id(username, full_name),
                            task_item:export_task_items!task_item_id(
                                unit,
                                products(name, sku),
                                export_tasks(code, system_code)
                            )
                        `)
                        .eq('system_code', currentSystem.code)
                        .gte('created_at', fromIso)
                        .lte('created_at', toIso)
                        .order('created_at', { ascending: false })
                        .range(pFrom, pFrom + FETCH_PAGE_SIZE - 1)

                    if (error) throw error
                    const rows = (data || []) as any[]
                    rows.forEach((r: any) => {
                        const ti = Array.isArray(r.task_item) ? r.task_item[0] : r.task_item
                        const task = Array.isArray(ti?.export_tasks) ? ti.export_tasks[0] : ti?.export_tasks
                        if (task?.system_code && task.system_code !== currentSystem.code) return
                        allPicks.push({
                            createdAt: r.created_at,
                            day: r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd') : '',
                            hour: r.created_at ? format(new Date(r.created_at), 'HH') : '',
                            pickerName: r.picker?.full_name || r.picker?.username || 'Không rõ',
                            productName: ti?.products?.name || 'N/A',
                            sku: ti?.products?.sku || '',
                            taskCode: task?.code || 'N/A',
                            quantity: Number(r.quantity) || 0,
                            unit: ti?.unit || '',
                            note: r.note || '',
                        })
                    })
                    if (rows.length < FETCH_PAGE_SIZE) pHasMore = false
                    else pFrom += FETCH_PAGE_SIZE
                }
            } catch (pickErr) {
                console.warn('Không đọc được lịch sử hạ hàng (bỏ qua thống kê theo giờ):', pickErr)
            }
            setPickRows(allPicks)
            setFetchedAt(new Date())
        } catch (error: any) {
            console.error('Error fetching export stats:', error)
            showToast('Lỗi tải dữ liệu thống kê: ' + (error?.message || ''), 'error')
        } finally {
            setLoading(false)
        }
    }, [currentSystem, dateFrom, dateTo, showToast])

    useEffect(() => {
        if (active && currentSystem?.code) {
            fetchData()
        }
    }, [active, currentSystem, fetchData])

    useEffect(() => {
        setPage(1)
    }, [searchTerm, groupMode, dateFrom, dateTo])

    const filteredItems = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return itemRows
        return itemRows.filter(r =>
            r.productName.toLowerCase().includes(q) ||
            r.sku.toLowerCase().includes(q) ||
            r.taskCode.toLowerCase().includes(q) ||
            (r.productionCode || '').toLowerCase().includes(q) ||
            r.lotCode.toLowerCase().includes(q)
        )
    }, [itemRows, searchTerm])

    const filteredPicks = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return pickRows
        return pickRows.filter(r =>
            r.productName.toLowerCase().includes(q) ||
            r.sku.toLowerCase().includes(q) ||
            r.taskCode.toLowerCase().includes(q) ||
            r.pickerName.toLowerCase().includes(q)
        )
    }, [pickRows, searchTerm])

    const dayGroups = useMemo(() => {
        const map = new Map<string, DayGroup>()
        filteredItems.forEach(r => {
            if (!r.day) return
            if (!map.has(r.day)) {
                map.set(r.day, {
                    day: r.day, taskCodes: new Set(), completedTaskCodes: new Set(),
                    lineCount: 0, requestedQty: 0, exportedQty: 0, pickQty: 0,
                })
            }
            const g = map.get(r.day)!
            g.taskCodes.add(r.taskCode)
            if (r.taskStatus === 'Completed') g.completedTaskCodes.add(r.taskCode)
            g.lineCount += 1
            g.requestedQty += r.quantity
            g.exportedQty += r.exportedQuantity
        })
        filteredPicks.forEach(p => {
            if (!p.day) return
            if (!map.has(p.day)) {
                map.set(p.day, {
                    day: p.day, taskCodes: new Set(), completedTaskCodes: new Set(),
                    lineCount: 0, requestedQty: 0, exportedQty: 0, pickQty: 0,
                })
            }
            map.get(p.day)!.pickQty += p.quantity
        })
        return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day))
    }, [filteredItems, filteredPicks])

    const productGroups = useMemo(() => {
        const map = new Map<string, ProductGroup>()
        filteredItems.forEach(r => {
            const key = `${r.sku}__${r.productName}`
            if (!map.has(key)) {
                map.set(key, {
                    key, productName: r.productName, sku: r.sku, unit: r.unit,
                    lineCount: 0, requestedQty: 0, exportedQty: 0,
                })
            }
            const g = map.get(key)!
            g.lineCount += 1
            g.requestedQty += r.quantity
            g.exportedQty += r.exportedQuantity
            if (!g.unit && r.unit) g.unit = r.unit
        })
        return Array.from(map.values()).sort((a, b) => b.exportedQty - a.exportedQty || b.requestedQty - a.requestedQty)
    }, [filteredItems])

    const taskGroups = useMemo(() => {
        const map = new Map<string, TaskGroup>()
        filteredItems.forEach(r => {
            if (!map.has(r.taskCode)) {
                map.set(r.taskCode, {
                    taskCode: r.taskCode, taskStatus: r.taskStatus, taskCreatedAt: r.taskCreatedAt,
                    lineCount: 0, skuCount: 0, doneLineCount: 0, requestedQty: 0, exportedQty: 0,
                    products: new Set<string>(), notes: r.taskNotes || '',
                })
            }
            const g = map.get(r.taskCode)!
            g.lineCount += 1
            g.products.add(r.sku ? `${r.productName} (${r.sku})` : r.productName)
            g.requestedQty += r.quantity
            g.exportedQty += r.exportedQuantity
            if (r.exportedQuantity >= r.quantity - 1e-6) g.doneLineCount += 1
            if (!g.taskCreatedAt && r.taskCreatedAt) g.taskCreatedAt = r.taskCreatedAt
            if (g.taskStatus !== 'Completed' && r.taskStatus === 'Completed') g.taskStatus = r.taskStatus
        })
        map.forEach(g => { g.skuCount = g.products.size })
        return Array.from(map.values()).sort((a, b) => (b.taskCreatedAt || '').localeCompare(a.taskCreatedAt || ''))
    }, [filteredItems])

    const hourGroups = useMemo(() => {
        const map = new Map<string, HourGroup>()
        filteredPicks.forEach(p => {
            const key = `${p.day}__${p.hour}`
            if (!map.has(key)) {
                map.set(key, { key, day: p.day, hour: p.hour, pickCount: 0, pickers: new Set(), quantity: 0, unit: '' })
            }
            const g = map.get(key)!
            g.pickCount += 1
            g.pickers.add(p.pickerName)
            g.quantity += p.quantity
            if (!g.unit && p.unit) g.unit = p.unit
        })
        return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day) || a.hour.localeCompare(b.hour))
    }, [filteredPicks])

    const summary = useMemo(() => {
        const requested = filteredItems.reduce((s, r) => s + r.quantity, 0)
        const exported = filteredItems.reduce((s, r) => s + r.exportedQuantity, 0)
        return {
            taskCount: new Set(filteredItems.map(r => r.taskCode)).size,
            completedTaskCount: taskGroups.filter(t => t.taskStatus === 'Completed').length,
            lineCount: filteredItems.length,
            skuCount: new Set(filteredItems.map(r => r.sku || r.productName)).size,
            requested,
            exported,
            remaining: requested - exported,
            rate: requested > 0 ? Math.round((exported / requested) * 100) : 0,
            pickCount: filteredPicks.length,
            pickQty: filteredPicks.reduce((s, p) => s + p.quantity, 0),
            pickerCount: new Set(filteredPicks.map(p => p.pickerName)).size,
        }
    }, [filteredItems, filteredPicks, taskGroups])

    const chartData = useMemo(
        () => [...dayGroups].reverse().map(d => ({
            day: format(new Date(`${d.day}T00:00:00`), 'dd/MM'),
            yeuCau: Number(d.requestedQty.toFixed(2)),
            daXuat: Number(d.exportedQty.toFixed(2)),
        })),
        [dayGroups]
    )

    const detailSource = useMemo<DetailRow[]>(() => {
        if (groupMode === 'DAY') {
            return dayGroups.map(d => ({
                id: d.day,
                numericFrom: 3,
                cells: [
                    { label: 'Ngày', value: d.day ? format(new Date(`${d.day}T00:00:00`), 'dd/MM/yyyy') : '-' },
                    { label: 'Số lệnh', value: String(d.taskCodes.size) },
                    { label: 'Dòng hàng', value: String(d.lineCount) },
                    { label: 'Yêu cầu', value: formatQuantityFull(d.requestedQty) },
                    { label: 'Đã xuất', value: formatQuantityFull(d.exportedQty) },
                    { label: 'Hạ trong ngày', value: formatQuantityFull(d.pickQty) },
                    { label: 'Hoàn thành', value: `${d.completedTaskCodes.size}/${d.taskCodes.size}` },
                ],
            }))
        }
        if (groupMode === 'PRODUCT') {
            return productGroups.map(p => ({
                id: p.key,
                numericFrom: 4,
                cells: [
                    { label: 'Sản phẩm', value: p.productName },
                    { label: 'SKU', value: p.sku || '-' },
                    { label: 'ĐVT', value: p.unit || '-' },
                    { label: 'Số dòng', value: String(p.lineCount) },
                    { label: 'Yêu cầu', value: formatQuantityFull(p.requestedQty) },
                    { label: 'Đã xuất', value: formatQuantityFull(p.exportedQty) },
                    { label: 'Còn lại', value: formatQuantityFull(p.requestedQty - p.exportedQty) },
                ],
            }))
        }
        if (groupMode === 'TASK') {
            return taskGroups.map(t => {
                const productsText = Array.from(t.products).join(', ')
                return {
                    id: t.taskCode,
                    numericFrom: 4,
                    cells: [
                        { label: 'Mã lệnh', value: t.taskCode, strong: true },
                        { label: 'Ngày tạo', value: t.taskCreatedAt ? format(new Date(t.taskCreatedAt), 'dd/MM/yyyy HH:mm') : '-' },
                        { label: 'Trạng thái', value: TASK_STATUS_LABELS[t.taskStatus] || t.taskStatus },
                        { label: 'Mặt hàng', value: String(t.skuCount) },
                        { label: 'Dòng hàng', value: String(t.lineCount) },
                        { label: 'Dòng đã xong', value: `${t.doneLineCount}/${t.lineCount}` },
                        { label: 'Yêu cầu', value: formatQuantityFull(t.requestedQty) },
                        { label: 'Đã xuất', value: formatQuantityFull(t.exportedQty) },
                        { label: 'Sản phẩm trong lệnh', value: productsText || '-', title: productsText, truncate: true },
                    ],
                }
            })
        }
        return hourGroups.map(g => ({
            id: g.key,
            numericFrom: 2,
            cells: [
                { label: 'Ngày', value: g.day ? format(new Date(`${g.day}T00:00:00`), 'dd/MM/yyyy') : '-' },
                { label: 'Khung giờ', value: `${g.hour}h` },
                { label: 'Số lượt hạ', value: String(g.pickCount) },
                { label: 'Số lượng', value: formatQuantityFull(g.quantity) },
                { label: 'ĐVT', value: g.unit || '-' },
                { label: 'Nhân viên', value: Array.from(g.pickers).join(', ') },
            ],
        }))
    }, [groupMode, dayGroups, productGroups, taskGroups, hourGroups])

    const totalPages = Math.max(1, Math.ceil(detailSource.length / ROW_PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const pagedRows = detailSource.slice((safePage - 1) * ROW_PAGE_SIZE, safePage * ROW_PAGE_SIZE)

    const applyPreset = (preset: 'today' | 'week' | 'month' | 'quarter') => {
        const now = new Date()
        if (preset === 'today') {
            setDateFrom(format(now, 'yyyy-MM-dd'))
            setDateTo(format(now, 'yyyy-MM-dd'))
        } else if (preset === 'week') {
            setDateFrom(format(subDays(now, 6), 'yyyy-MM-dd'))
            setDateTo(format(now, 'yyyy-MM-dd'))
        } else if (preset === 'month') {
            setDateFrom(format(startOfMonth(now), 'yyyy-MM-dd'))
            setDateTo(format(now, 'yyyy-MM-dd'))
        } else {
            setDateFrom(format(subDays(now, 89), 'yyyy-MM-dd'))
            setDateTo(format(now, 'yyyy-MM-dd'))
        }
    }

    const handleExportExcel = async () => {
        if (filteredItems.length === 0 && filteredPicks.length === 0) {
            showToast('Không có dữ liệu trong khoảng thời gian này', 'warning')
            return
        }
        try {
            setExporting(true)
            await exportOrderReportToExcel({
                systemName: currentSystem?.name || currentSystem?.code || '',
                dateFrom,
                dateTo,
                summary: [
                    { label: 'Kho (phân hệ)', value: currentSystem?.name || currentSystem?.code || '-' },
                    { label: 'Kỳ báo cáo', value: `${format(new Date(`${dateFrom}T00:00:00`), 'dd/MM/yyyy')} - ${format(new Date(`${dateTo}T23:59:59`), 'dd/MM/yyyy')}` },
                    { label: 'Tổng số lệnh xuất', value: summary.taskCount },
                    { label: 'Số lệnh đã hoàn thành', value: summary.completedTaskCount },
                    { label: 'Tổng dòng hàng', value: summary.lineCount },
                    { label: 'Số mặt hàng (SKU)', value: summary.skuCount },
                    { label: 'Tổng SL yêu cầu', value: formatQuantityFull(summary.requested) },
                    { label: 'Tổng SL đã xuất', value: formatQuantityFull(summary.exported) },
                    { label: 'Còn lại chưa xuất', value: formatQuantityFull(summary.remaining) },
                    { label: 'Tỷ lệ đã xuất', value: `${summary.rate}%` },
                    { label: 'Số lượt hạ hàng', value: summary.pickCount },
                    { label: 'SL hạ theo lượt', value: formatQuantityFull(summary.pickQty) },
                    { label: 'Số nhân viên tham gia', value: summary.pickerCount },
                ],
                dayRows: dayGroups.map(d => ({
                    date: d.day ? format(new Date(`${d.day}T00:00:00`), 'dd/MM/yyyy') : '-',
                    taskCount: d.taskCodes.size,
                    lineCount: d.lineCount,
                    requestedQty: d.requestedQty,
                    exportedQty: d.exportedQty,
                    completedTasks: d.completedTaskCodes.size,
                })),
                productRows: productGroups.map(p => ({
                    productName: p.productName,
                    sku: p.sku,
                    unit: p.unit,
                    lineCount: p.lineCount,
                    requestedQty: p.requestedQty,
                    exportedQty: p.exportedQty,
                })),
                taskRows: taskGroups.map(t => ({
                    taskCode: t.taskCode,
                    taskCreatedAt: t.taskCreatedAt ? format(new Date(t.taskCreatedAt), 'dd/MM/yyyy HH:mm') : '-',
                    taskStatus: TASK_STATUS_LABELS[t.taskStatus] || t.taskStatus,
                    skuCount: t.skuCount,
                    lineCount: t.lineCount,
                    doneLineCount: t.doneLineCount,
                    requestedQty: t.requestedQty,
                    exportedQty: t.exportedQty,
                    products: Array.from(t.products).join(', '),
                    notes: t.notes,
                })),
                pickRows: filteredPicks.map(p => ({
                    date: format(new Date(p.createdAt), 'dd/MM/yyyy'),
                    hour: format(new Date(p.createdAt), 'HH:mm'),
                    pickerName: p.pickerName,
                    productName: p.productName,
                    sku: p.sku,
                    taskCode: p.taskCode,
                    quantity: p.quantity,
                    unit: p.unit,
                    note: p.note,
                })),
                detailRows: filteredItems.map(r => ({
                    taskCode: r.taskCode,
                    taskCreatedAt: r.taskCreatedAt ? format(new Date(r.taskCreatedAt), 'dd/MM/yyyy HH:mm') : '-',
                    taskStatus: r.taskStatus,
                    productName: r.productName,
                    sku: r.sku,
                    productionCode: r.productionCode || '-',
                    lotCode: r.lotCode,
                    positionCode: r.positionCode,
                    requestedQty: r.quantity,
                    exportedQty: r.exportedQuantity,
                    unit: r.unit,
                    lineStatus: r.lineStatus,
                    taskNotes: r.taskNotes,
                })),
            })
            showToast('Xuất Excel báo cáo thành công', 'success')
        } catch (error: any) {
            console.error('Lỗi khi xuất excel:', error)
            showToast('Không thể xuất file Excel: ' + (error?.message || ''), 'error')
        } finally {
            setExporting(false)
        }
    }

    const cardTone = (tone: string) => ({
        blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
        emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
        amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
        violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
    }[tone] || 'bg-stone-100 text-stone-600')

    return (
        <div className="space-y-6">
            {/* Filter bar */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                        <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="date"
                            value={dateFrom}
                            max={dateTo}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <div className="relative">
                        <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="date"
                            value={dateTo}
                            min={dateFrom}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Lọc sản phẩm, SKU, mã lệnh..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-stone-100 dark:bg-zinc-700 text-stone-700 dark:text-stone-200 text-sm font-bold hover:bg-stone-200 transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Làm mới
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || loading}
                            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                        >
                            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Xuất Excel
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {([['today', 'Hôm nay'], ['week', '7 ngày'], ['month', 'Tháng này'], ['quarter', '90 ngày']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => applyPreset(key)}
                            className="px-3 py-1 rounded-full text-xs font-bold bg-stone-100 dark:bg-zinc-700 text-stone-600 dark:text-stone-300 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                        >
                            {label}
                        </button>
                    ))}
                    {fetchedAt && (
                        <span className="text-xs text-stone-400 ml-auto">
                            Cập nhật lúc {format(fetchedAt, 'HH:mm dd/MM/yyyy')}
                        </span>
                    )}
                </div>
            </div>

            {loading && itemRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-xl border border-dashed border-stone-200 dark:border-zinc-700">
                    <Loader2 className="animate-spin text-blue-600 mb-3" size={30} />
                    <p className="text-stone-500 font-medium">Đang truy xuất dữ liệu xuất kho...</p>
                </div>
            ) : (
                <>
                    {/* Overview cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Số lệnh xuất', value: formatQuantityFull(summary.taskCount), sub: `Hoàn thành ${summary.completedTaskCount}/${summary.taskCount}`, icon: FileStack, tone: 'blue' },
                            { label: 'Dòng hàng', value: formatQuantityFull(summary.lineCount), sub: `${summary.skuCount} mặt hàng (SKU)`, icon: Boxes, tone: 'violet' },
                            { label: 'SL yêu cầu', value: formatQuantityFull(summary.requested), sub: 'Tổng ghi trên lệnh xuất', icon: Package, tone: 'amber' },
                            { label: 'SL đã xuất', value: formatQuantityFull(summary.exported), sub: `Đạt ${summary.rate}% kế hoạch`, icon: TrendingDown, tone: 'emerald' },
                        ].map((c, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm p-4 flex items-center gap-3">
                                <div className={`p-2.5 rounded-lg ${cardTone(c.tone)}`}>
                                    <c.icon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{c.label}</p>
                                    <p className="text-lg font-black text-stone-800 dark:text-stone-100 truncate">{c.value}</p>
                                    {c.sub && <p className="text-[11px] font-bold text-stone-400 truncate">{c.sub}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                            { label: 'Chưa xuất còn lại', value: formatQuantityFull(summary.remaining), sub: 'Yêu cầu trừ thực xuất', icon: Package, tone: 'amber' },
                            { label: 'Lượt hạ hàng', value: formatQuantityFull(summary.pickCount), sub: `${summary.pickerCount} nhân viên`, icon: Clock3, tone: 'blue' },
                            { label: 'SL hạ theo lượt', value: formatQuantityFull(summary.pickQty), sub: 'Tính theo thời điểm hạ', icon: TrendingDown, tone: 'emerald' },
                            { label: 'Số ngày có phát sinh', value: formatQuantityFull(dayGroups.length), sub: 'Trong kỳ báo cáo', icon: CalendarDays, tone: 'violet' },
                        ].map((c, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm p-4 flex items-center gap-3">
                                <div className={`p-2.5 rounded-lg ${cardTone(c.tone)}`}>
                                    <c.icon size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">{c.label}</p>
                                    <p className="text-lg font-black text-stone-800 dark:text-stone-100 truncate">{c.value}</p>
                                    {c.sub && <p className="text-[11px] font-bold text-stone-400 truncate">{c.sub}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Chart */}
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <BarChart3 size={16} className="text-blue-600" />
                            <h3 className="font-bold text-stone-800 dark:text-stone-100">Diễn biến sản lượng xuất theo ngày</h3>
                        </div>
                        {chartData.length === 0 ? (
                            <p className="text-sm text-stone-400 py-8 text-center">Chưa có dữ liệu để vẽ biểu đồ</p>
                        ) : (
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#d6d3d1' }} />
                                        <YAxis tick={{ fontSize: 11, fill: '#78716c' }} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e7e5e4' }}
                                            formatter={(value: any, name: any) => [formatQuantityFull(Number(value)), name === 'yeuCau' ? 'Yêu cầu' : 'Đã xuất']}
                                            labelFormatter={(label: any) => `Ngày ${label}`}
                                        />
                                        <Legend
                                            verticalAlign="top"
                                            align="right"
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                            formatter={(value: any) => (value === 'yeuCau' ? 'Yêu cầu' : 'Đã xuất')}
                                        />
                                        <Bar dataKey="yeuCau" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                        <Bar dataKey="daXuat" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={28} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Group tables */}
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-stone-100 dark:border-zinc-700">
                            <div className="flex bg-stone-100 dark:bg-zinc-900 p-1 rounded-lg overflow-x-auto">
                                {([['DAY', 'Theo ngày'], ['PRODUCT', 'Theo sản phẩm'], ['TASK', 'Theo lệnh'], ['HOUR', 'Theo giờ hạ']] as const).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setGroupMode(key)}
                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors whitespace-nowrap ${groupMode === key ? 'bg-white dark:bg-zinc-700 text-blue-600 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <span className="text-sm font-semibold text-stone-500 dark:text-stone-400 ml-auto">
                                {detailSource.length} dòng thống kê
                            </span>
                        </div>

                        {detailSource.length === 0 ? (
                            <div className="p-16 text-center">
                                <Package className="mx-auto text-stone-300 mb-3" size={44} />
                                <p className="text-stone-500 font-medium">Không có dữ liệu xuất trong khoảng thời gian này</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-stone-50 dark:bg-zinc-900/50 border-b border-stone-100 dark:border-zinc-700">
                                                {detailSource[0].cells.map((c, i) => (
                                                    <th key={i} className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-stone-500 ${i >= detailSource[0].numericFrom ? 'text-right' : 'text-left'}`}>
                                                        {c.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                                            {pagedRows.map(row => (
                                                <tr key={row.id} className="hover:bg-blue-50/40 dark:hover:bg-zinc-700/40 transition-colors">
                                                    {row.cells.map((c, i) => (
                                                        <td key={i} title={c.title} className={`px-4 py-3 font-medium text-stone-700 dark:text-stone-300 ${i >= row.numericFrom ? 'text-right tabular-nums' : 'text-left'}`}>
                                                            <span className={`${(i === 0 || c.strong) ? 'font-bold text-stone-900 dark:text-stone-100' : ''} ${c.truncate ? 'block max-w-[320px] truncate align-bottom' : ''}`}>{c.value}</span>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {totalPages > 1 && (
                                    <div className="p-3 flex items-center justify-center gap-2 border-t border-stone-100 dark:border-zinc-700">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={safePage === 1}
                                            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-stone-100 dark:bg-zinc-700 text-stone-600 dark:text-stone-300 disabled:opacity-40"
                                        >
                                            Trước
                                        </button>
                                        <span className="text-sm font-bold text-stone-600 dark:text-stone-300">
                                            {safePage} / {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={safePage === totalPages}
                                            className="px-3 py-1.5 rounded-lg text-sm font-bold bg-stone-100 dark:bg-zinc-700 text-stone-600 dark:text-stone-300 disabled:opacity-40"
                                        >
                                            Sau
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
