'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
    BarChart3,
    Award,
    AlertTriangle,
    Star,
    FileSpreadsheet,
    Calendar,
    TrendingUp,
    Search,
    RefreshCw,
    MapPin,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import {
    WorkPlanItem,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    DIFFICULTY_CONFIG,
    formatVNDateSlash,
    formatWorkloadSummaryText,
} from './types'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useToast } from '@/components/ui/ToastProvider'

interface WorkPlanAnalyticsTabProps {
    systemCode: string
    systemName: string
    companyId?: string | null
}

interface EmployeeStatRow {
    name: string
    type: 'member' | 'team' | 'custom'
    totalAssigned: number
    completed: number
    partial: number
    uncompleted: number
    pending: number
    avgProgress: number
    ratedCount: number
    totalStars: number
    avgStars: number | null
    excellentCount: number
    needsImprovementCount: number
    totalPositions: number
    totalPackages: number
    weightedScore: number
    grade: 'A+' | 'A' | 'B' | 'C'
    items: WorkPlanItem[]
}

export default function WorkPlanAnalyticsTab({
    systemCode,
    systemName,
    companyId,
}: WorkPlanAnalyticsTabProps) {
    const { showToast } = useToast()

    const [dateFrom, setDateFrom] = useState<string>(() => {
        const d = new Date()
        d.setDate(1)
        return d.toISOString().slice(0, 10)
    })
    const [dateTo, setDateTo] = useState<string>(() => {
        const d = new Date()
        d.setDate(d.getDate() + 1)
        return d.toISOString().slice(0, 10)
    })
    const [rangePreset, setRangePreset] = useState<'week' | 'month' | '7days' | 'custom'>('month')
    const [items, setItems] = useState<WorkPlanItem[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [searchEmployee, setSearchEmployee] = useState<string>('')
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStatRow | null>(null)
    const [exportingExcel, setExportingExcel] = useState<boolean>(false)

    const applyPreset = (preset: 'week' | 'month' | '7days') => {
        setRangePreset(preset)
        const now = new Date()
        const toStr = new Date(now.getTime() + 86400000).toISOString().slice(0, 10)

        if (preset === '7days') {
            const from = new Date(now.getTime() - 6 * 86400000)
            setDateFrom(from.toISOString().slice(0, 10))
            setDateTo(toStr)
        } else if (preset === 'week') {
            const day = now.getDay() || 7
            const mon = new Date(now)
            mon.setDate(now.getDate() - day + 1)
            setDateFrom(mon.toISOString().slice(0, 10))
            setDateTo(toStr)
        } else if (preset === 'month') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
            setDateFrom(first.toISOString().slice(0, 10))
            setDateTo(toStr)
        }
    }

    const fetchRangeItems = useCallback(async () => {
        if (!systemCode) return
        setLoading(true)
        try {
            let query = (supabase as any)
                .from('work_plan_items')
                .select('*')
                .eq('system_code', systemCode)
                .gte('plan_date', dateFrom)
                .lte('plan_date', dateTo)
                .order('plan_date', { ascending: false })
                .order('sort_order', { ascending: true })

            if (companyId) {
                query = query.eq('company_id', companyId)
            }

            const { data, error } = await query
            if (error) throw error
            setItems(data || [])
        } catch (err) {
            console.error('Error loading analytics work_plan_items:', err)
        } finally {
            setLoading(false)
        }
    }, [systemCode, companyId, dateFrom, dateTo])

    useEffect(() => {
        fetchRangeItems()
    }, [fetchRangeItems])

    // Overall KPIs
    const kpis = useMemo(() => {
        const active = items.filter(i => i.status !== 'cancelled')
        const completed = active.filter(i => i.status === 'completed').length
        const partial = active.filter(i => i.status === 'partial').length
        const uncompleted = active.filter(i => i.status === 'uncompleted').length
        const avgProgress =
            active.length > 0
                ? Math.round(
                      active.reduce((s, i) => s + (i.progress_percent || 0), 0) / active.length
                  )
                : 0
        const rated = active.filter(i => i.rating_stars && i.rating_stars > 0)
        const avgStars =
            rated.length > 0
                ? (
                      rated.reduce((s, i) => s + (i.rating_stars || 0), 0) / rated.length
                  ).toFixed(1)
                : null

        const totalPositions = active.reduce(
            (s, i) => s + (Number(i.workload_metrics?.positions_count) || 0),
            0
        )
        const distinctDays = new Set(active.map(i => i.plan_date)).size

        return {
            total: active.length,
            completed,
            partial,
            uncompleted,
            avgProgress,
            avgStars,
            totalPositions,
            distinctDays,
        }
    }, [items])

    // Employee / Team Performance Aggregation
    const employeeStats = useMemo(() => {
        const map = new Map<string, EmployeeStatRow>()

        const addStat = (
            keyName: string,
            type: 'member' | 'team' | 'custom',
            item: WorkPlanItem
        ) => {
            if (item.status === 'cancelled') return
            const normKey = keyName.trim().toLowerCase()
            if (!map.has(normKey)) {
                map.set(normKey, {
                    name: keyName.trim(),
                    type,
                    totalAssigned: 0,
                    completed: 0,
                    partial: 0,
                    uncompleted: 0,
                    pending: 0,
                    avgProgress: 0,
                    ratedCount: 0,
                    totalStars: 0,
                    avgStars: null,
                    excellentCount: 0,
                    needsImprovementCount: 0,
                    totalPositions: 0,
                    totalPackages: 0,
                    weightedScore: 0,
                    grade: 'A',
                    items: [],
                })
            }

            const row = map.get(normKey)!
            row.totalAssigned += 1
            row.items.push(item)

            const wl = item.workload_metrics
            const mult =
                wl?.difficulty && DIFFICULTY_CONFIG[wl.difficulty]
                    ? DIFFICULTY_CONFIG[wl.difficulty].multiplier
                    : 1.0

            row.totalPositions += Number(wl?.positions_count) || 0
            row.totalPackages += Number(wl?.packages_count) || 0
            row.weightedScore += ((item.progress_percent || 0) / 100) * mult

            if (item.status === 'completed') row.completed += 1
            else if (item.status === 'partial') row.partial += 1
            else if (item.status === 'uncompleted') row.uncompleted += 1
            else row.pending += 1

            if (item.rating_stars && item.rating_stars > 0) {
                row.ratedCount += 1
                row.totalStars += item.rating_stars
            }
            if (item.rating === 'excellent') row.excellentCount += 1
            if (item.rating === 'needs_improvement' || item.rating === 'poor') {
                row.needsImprovementCount += 1
            }
        }

        items.forEach(item => {
            const assignees = Array.isArray(item.assignees) ? item.assignees : []
            if (assignees.length === 0) {
                addStat('Toàn đội kho (Chung)', 'team', item)
            } else {
                assignees.forEach(a => {
                    if (a?.name) addStat(a.name, a.type || 'member', item)
                })
            }
        })

        const rows = Array.from(map.values()).map(r => {
            const sumProg = r.items.reduce((s, i) => s + (i.progress_percent || 0), 0)
            const avgProgress = r.totalAssigned > 0 ? Math.round(sumProg / r.totalAssigned) : 0
            const avgStars =
                r.ratedCount > 0 ? Number((r.totalStars / r.ratedCount).toFixed(1)) : null

            let grade: 'A+' | 'A' | 'B' | 'C' = 'B'
            if (avgProgress >= 90 && (avgStars === null || avgStars >= 4.5)) grade = 'A+'
            else if (avgProgress >= 80 && (avgStars === null || avgStars >= 3.8)) grade = 'A'
            else if (avgProgress >= 60) grade = 'B'
            else grade = 'C'

            return {
                ...r,
                avgProgress,
                avgStars,
                weightedScore: Math.round(r.weightedScore * 10) / 10,
                grade,
            }
        })

        rows.sort(
            (a, b) =>
                b.weightedScore - a.weightedScore ||
                b.completed - a.completed ||
                b.avgProgress - a.avgProgress
        )

        const q = searchEmployee.trim().toLowerCase()
        if (!q) return rows
        return rows.filter(r => r.name.toLowerCase().includes(q))
    }, [items, searchEmployee])

    const handleExportExcel = async () => {
        setExportingExcel(true)
        try {
            const workbook = new ExcelJS.Workbook()
            workbook.creator = 'Modular WMS'

            // Sheet 1: Bảng Hiệu Suất Nhân Sự
            const wsEmp = workbook.addWorksheet('Hiệu suất Nhân viên')
            wsEmp.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Nhân viên / Tổ đội', key: 'name', width: 28 },
                { header: 'Phân loại', key: 'type', width: 15 },
                { header: 'Tổng việc giao', key: 'total', width: 15 },
                { header: 'Hoàn thành (100%)', key: 'completed', width: 18 },
                { header: 'Tổng Vị trí xử lý', key: 'positions', width: 18 },
                { header: 'Tổng Thùng/Kiện', key: 'packages', width: 18 },
                { header: 'Điểm Khối lượng (Nặng/Nhẹ)', key: 'weighted', width: 24 },
                { header: 'Tiến độ TB (%)', key: 'avgProgress', width: 16 },
                { header: 'Điểm Sao TB (/5)', key: 'avgStars', width: 16 },
                { header: 'Xếp loại', key: 'grade', width: 12 },
            ]

            wsEmp.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
            wsEmp.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E3A8A' },
            }

            employeeStats.forEach((emp, i) => {
                wsEmp.addRow({
                    stt: i + 1,
                    name: emp.name,
                    type: emp.type === 'team' ? 'Tổ / Đội' : 'Nhân viên',
                    total: emp.totalAssigned,
                    completed: emp.completed,
                    positions: emp.totalPositions || '-',
                    packages: emp.totalPackages || '-',
                    weighted: emp.weightedScore,
                    avgProgress: `${emp.avgProgress}%`,
                    avgStars: emp.avgStars ?? '-',
                    grade: emp.grade,
                })
            })

            // Sheet 2: Chi Tiết Công Việc & Đánh Giá
            const wsDetail = workbook.addWorksheet('Chi tiết Kế hoạch & Đánh giá')
            wsDetail.columns = [
                { header: 'Ngày', key: 'date', width: 14 },
                { header: 'STT Ngày', key: 'order', width: 10 },
                { header: 'Nội dung công việc', key: 'content', width: 45 },
                { header: 'Người / Đội phụ trách', key: 'assignees', width: 26 },
                { header: 'Độ nặng/nhẹ', key: 'difficulty', width: 16 },
                { header: 'Số vị trí', key: 'positions', width: 12 },
                { header: 'Số lượng & Lệnh xuất', key: 'workload', width: 38 },
                { header: 'Trạng thái cuối ngày', key: 'status', width: 18 },
                { header: 'Tiến độ (%)', key: 'progress', width: 14 },
                { header: 'Đánh giá chất lượng', key: 'rating', width: 18 },
                { header: 'Nhận xét của Quản lý', key: 'note', width: 36 },
            ]

            wsDetail.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
            wsDetail.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF047857' },
            }

            items.forEach(item => {
                const wl = item.workload_metrics
                const diffLabel =
                    wl?.difficulty && DIFFICULTY_CONFIG[wl.difficulty]
                        ? DIFFICULTY_CONFIG[wl.difficulty].shortLabel
                        : '-'
                wsDetail.addRow({
                    date: formatVNDateSlash(item.plan_date),
                    order: item.sort_order,
                    content: item.content,
                    assignees: Array.isArray(item.assignees)
                        ? item.assignees.map(a => a.name).join(', ')
                        : '',
                    difficulty: diffLabel,
                    positions: wl?.positions_count || '-',
                    workload: formatWorkloadSummaryText(wl) || '-',
                    status: ITEM_STATUS_CONFIG[item.status]?.label || item.status,
                    progress: `${item.progress_percent}%`,
                    rating: item.rating ? RATING_CONFIG[item.rating].label : '-',
                    note: item.evaluation_note || '',
                })
            })

            const buffer = await workbook.xlsx.writeBuffer()
            const blob = new Blob([buffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            saveAs(blob, `BaoCao_KeHoach_DanhGiaCV_${dateFrom}_${dateTo}.xlsx`)
            showToast('Xuất báo cáo Excel thành công!', 'success')
        } catch (err) {
            console.error('Export Excel error:', err)
            showToast('Lỗi khi xuất file Excel', 'error')
        } finally {
            setExportingExcel(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Filter & Action Toolbar */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                        {(
                            [
                                { id: '7days', label: '7 ngày qua' },
                                { id: 'week', label: 'Tuần này' },
                                { id: 'month', label: 'Tháng này' },
                            ] as const
                        ).map(p => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => applyPreset(p.id)}
                                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                    rangePreset === p.id
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-stone-600 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
                        <Calendar size={14} className="text-indigo-600" />
                        <span>Từ:</span>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => {
                                setRangePreset('custom')
                                setDateFrom(e.target.value)
                            }}
                            className="font-bold text-stone-800 bg-transparent outline-hidden"
                        />
                        <span>đến</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => {
                                setRangePreset('custom')
                                setDateTo(e.target.value)
                            }}
                            className="font-bold text-stone-800 bg-transparent outline-hidden"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={fetchRangeItems}
                        className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-600"
                        title="Làm mới thống kê"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <button
                    type="button"
                    disabled={exportingExcel || items.length === 0}
                    onClick={handleExportExcel}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                >
                    <FileSpreadsheet size={16} />
                    {exportingExcel ? 'Đang xuất Excel...' : 'Xuất Báo Cáo Excel (.xlsx)'}
                </button>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase">
                        <span>Tổng Đầu Việc Đã Giao</span>
                        <BarChart3 size={18} className="text-indigo-600" />
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2">{kpis.total}</div>
                    <div className="text-xs text-stone-500 mt-1">
                        Trong {kpis.distinctDays} ngày làm việc ({systemName})
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase">
                        <span>Tỷ Lệ Hoàn Thành TB</span>
                        <TrendingUp size={18} className="text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-700 mt-2">
                        {kpis.avgProgress}%
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                        Hoàn thành 100%: <b>{kpis.completed}</b> • Một phần:{' '}
                        <b>{kpis.partial}</b>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase">
                        <span>Tổng Vị Trí Đã Hạ/Xếp</span>
                        <MapPin size={18} className="text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-700 mt-2">
                        {kpis.totalPositions.toLocaleString('vi-VN')} vị trí
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                        Tổng hợp từ số liệu Lệnh xuất kho liên kết
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase">
                        <span>Chất Lượng Trung Bình</span>
                        <Star size={18} className="text-amber-500 fill-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">
                        {kpis.avgStars ? `${kpis.avgStars} / 5.0 ⭐` : 'Chưa chấm'}
                    </div>
                    <div className="text-xs text-stone-500 mt-1">
                        Tồn đọng: <b className="text-rose-600">{kpis.uncompleted}</b> việc
                    </div>
                </div>
            </div>

            {/* Employee Performance Leaderboard Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Award size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm md:text-base font-bold text-stone-800">
                                Bảng Tổng Kết Hiệu Suất & Khối Lượng Công Việc Nhân Viên
                            </h3>
                            <p className="text-xs text-stone-500">
                                Có tính hệ số độ nặng/nhẹ (x1.0 → x2.0) và tổng số vị trí / số thùng đã xử lý
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                            type="text"
                            value={searchEmployee}
                            onChange={e => setSearchEmployee(e.target.value)}
                            placeholder="Tìm tên nhân viên / đội..."
                            className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-200 text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500 w-56"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-sm text-stone-500">
                        Đang tổng hợp dữ liệu hiệu suất...
                    </div>
                ) : employeeStats.length === 0 ? (
                    <div className="p-12 text-center text-sm text-stone-500">
                        Chưa có dữ liệu công việc trong khoảng thời gian đã chọn.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-stone-50 text-stone-600 text-xs font-bold uppercase border-b border-stone-200">
                                    <th className="px-4 py-3 text-center w-14">Hạng</th>
                                    <th className="px-4 py-3 text-left">Nhân viên / Tổ đội</th>
                                    <th className="px-4 py-3 text-center">Tổng việc</th>
                                    <th className="px-4 py-3 text-center">Hoàn thành</th>
                                    <th className="px-4 py-3 text-center">Số Vị trí</th>
                                    <th className="px-4 py-3 text-center">Điểm Khối lượng</th>
                                    <th className="px-4 py-3 text-left w-40">Tiến độ TB</th>
                                    <th className="px-4 py-3 text-center">Điểm chất lượng</th>
                                    <th className="px-4 py-3 text-center">Xếp loại</th>
                                    <th className="px-4 py-3 text-right">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {employeeStats.map((row, idx) => (
                                    <tr
                                        key={row.name}
                                        className="hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <td className="px-4 py-3 text-center font-black text-stone-500">
                                            #{idx + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-stone-800">
                                                {row.name}
                                            </div>
                                            <div className="text-[11px] text-stone-500">
                                                {row.type === 'team'
                                                    ? 'Tổ / Đội vận hành'
                                                    : 'Nhân viên thực hiện'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-stone-800">
                                            {row.totalAssigned}
                                        </td>
                                        <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                            {row.completed}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {row.totalPositions > 0 ? (
                                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                                                    📍 {row.totalPositions}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold"
                                                title="Điểm quy đổi theo hệ số độ nặng/nhẹ (x1.0 đến x2.0)"
                                            >
                                                ⚡ {row.weightedScore} đ
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            row.avgProgress >= 85
                                                                ? 'bg-emerald-500'
                                                                : row.avgProgress >= 60
                                                                ? 'bg-amber-500'
                                                                : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${row.avgProgress}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-stone-700 w-10 text-right">
                                                    {row.avgProgress}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {row.avgStars ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                                    ★ {row.avgStars} / 5.0
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-400">
                                                    Chưa chấm
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span
                                                className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border ${
                                                    row.grade === 'A+'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : row.grade === 'A'
                                                        ? 'bg-teal-50 text-teal-700 border-teal-200'
                                                        : row.grade === 'B'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}
                                            >
                                                Hạng {row.grade}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedEmployee(
                                                        selectedEmployee?.name === row.name
                                                            ? null
                                                            : row
                                                    )
                                                }
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                                            >
                                                {selectedEmployee?.name === row.name
                                                    ? 'Đóng'
                                                    : 'Xem việc'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Drill-down drawer for selected employee */}
                {selectedEmployee && (
                    <div className="p-4 bg-indigo-50/40 border-t border-indigo-100 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                                Danh sách công việc của: {selectedEmployee.name} (
                                {selectedEmployee.items.length} việc • Điểm khối lượng:{' '}
                                {selectedEmployee.weightedScore} đ)
                            </h4>
                            <button
                                type="button"
                                onClick={() => setSelectedEmployee(null)}
                                className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                            >
                                Đóng chi tiết ✕
                            </button>
                        </div>
                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {selectedEmployee.items.map(item => {
                                const st = ITEM_STATUS_CONFIG[item.status]
                                const rt = item.rating ? RATING_CONFIG[item.rating] : null
                                const wlText = formatWorkloadSummaryText(item.workload_metrics)
                                return (
                                    <div
                                        key={item.id}
                                        className="p-2.5 rounded-xl bg-white border border-stone-200 flex flex-wrap items-center justify-between gap-2 text-xs"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="font-bold text-stone-800">
                                                <span className="text-indigo-600 mr-1.5">
                                                    [{formatVNDateSlash(item.plan_date)}]
                                                </span>
                                                {item.sort_order}. {item.content}
                                            </div>
                                            {wlText && (
                                                <div className="text-amber-700 font-semibold">
                                                    📊 {wlText}
                                                </div>
                                            )}
                                            {item.evaluation_note && (
                                                <div className="text-stone-500">
                                                    💬 Nhận xét: {item.evaluation_note}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`px-2 py-0.5 rounded-md font-bold ${st.bgClass} ${st.textClass}`}
                                            >
                                                {st.shortLabel} ({item.progress_percent}%)
                                            </span>
                                            {rt && (
                                                <span className="font-bold text-amber-600">
                                                    {'★'.repeat(rt.stars)} {rt.label}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
