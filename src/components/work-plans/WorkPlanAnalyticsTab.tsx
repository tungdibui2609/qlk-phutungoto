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
    ShieldAlert,
    CheckCircle2,
    Target,
    Camera,
    BookOpen,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import AnalyticsExportCardModal from './AnalyticsExportCardModal'
import {
    WorkPlanItem,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    DIFFICULTY_CONFIG,
    formatVNDateSlash,
    formatWorkloadSummaryText,
    WorkPlanAssigneeEvaluation,
    calculateAssigneeTaskStandardKpi,
    calculateWorkSpeed,
    WorkPlanTaskType,
    getStatisticsDocumentCounts,
} from './types'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useToast } from '@/components/ui/ToastProvider'

interface WorkPlanAnalyticsTabProps {
    systemCode: string
    systemName: string
    companyId?: string | null
}

export interface EmployeeIncidentItem {
    id: string
    name: string
    group: string
    severity?: string
    penalty_points: number
    note?: string | null
    taskContent: string
    taskDate: string
}

export interface EmployeeStatRow {
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
    totalWeightKg: number
    totalContainers: number
    totalDocuments: number // Số phiếu / chứng từ đã tạo của công việc thống kê
    totalPenaltyPoints: number
    totalBonusPoints: number
    safetyPenaltyPoints: number
    disciplinePenaltyPoints: number
    hasSevereIncident: boolean
    incidentsCount: number
    incidentsList: EmployeeIncidentItem[]
    // Phân định Việc chính (100đ cơ bản) vs Việc phụ (Cộng thêm mở trần lên 150đ)
    primaryTasksAssigned: number
    primaryTasksCompleted: number
    secondaryTasksAssigned: number
    secondaryTasksCompleted: number
    // Công việc Thống kê / Ghi chép: không ghi sản lượng & giờ làm
    statisticsTasksAssigned: number
    statisticsTasksCompleted: number
    primaryKpiScore: number // Điểm ca chuẩn (thang 100đ)
    secondaryBonusPoints: number // Điểm việc phụ / tăng cường cộng dồn
    // 4 Trụ Cột KPI Chuẩn (Thang 100 Điểm)
    productivityScore: number // Lao động 35-45đ • Thống kê mốc 30-40đ (trần 40đ)
    qualityScore: number // Lao động tối đa 20đ • Thống kê tối đa 40đ
    safetyScore: number // Gốc 20đ; 0 khi chỉ làm việc thống kê
    safetyMax: number // 20 (lao động) hoặc 0 (chỉ thống kê — không có nhóm An toàn)
    disciplineScore: number // Gốc 15đ (thống kê 20đ)
    productivityMaxTotal: number // Tổng trần năng suất các việc chính (để chia trung bình)
    qualityMaxTotal: number // Tổng trần chất lượng các việc chính
    statisticsPrimaryTasks: number // Số việc chính thuộc loại Thống kê
    productivityMax: number // Trần năng suất hiển thị (45 hoặc 40)
    qualityMax: number // Trần chất lượng hiển thị (20 hoặc 40)
    disciplineMax: number // Gốc kỷ luật hiển thị (15 hoặc 20)
    netKpiScore: number // Tổng điểm KPI chuẩn (Thang 100đ + Việc phụ -> lên 150đ+)
    weightedScore: number // Điểm quy đổi khối lượng
    // Thời gian làm việc, tăng ca (OT) & Tốc độ năng suất theo giờ
    totalRegularHours: number
    totalOvertimeHours: number
    totalWorkHours: number
    speedPositionsPerHour: number | null
    speedWeightTonsPerHour: number | null
    speedPackagesPerHour: number | null
    speedSummaryText: string
    grade: 'A+' | 'A' | 'B' | 'C'
    gradeLabel: string
    items: WorkPlanItem[]
}

function toLocalDateStr(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
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
        return toLocalDateStr(d)
    })
    const [dateTo, setDateTo] = useState<string>(() => {
        const d = new Date()
        return toLocalDateStr(d)
    })
    const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | '7days' | 'custom'>('month')
    const [items, setItems] = useState<WorkPlanItem[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [searchEmployee, setSearchEmployee] = useState<string>('')
    const [selectedEmployee, setSelectedEmployee] = useState<EmployeeStatRow | null>(null)
    const [exportingExcel, setExportingExcel] = useState<boolean>(false)
    const [showExportZaloModal, setShowExportZaloModal] = useState<boolean>(false)

    const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | '7days') => {
        setRangePreset(preset)
        const now = new Date()
        const todayStr = toLocalDateStr(now)

        if (preset === 'today') {
            setDateFrom(todayStr)
            setDateTo(todayStr)
        } else if (preset === 'yesterday') {
            const yest = new Date(now)
            yest.setDate(now.getDate() - 1)
            const yestStr = toLocalDateStr(yest)
            setDateFrom(yestStr)
            setDateTo(yestStr)
        } else if (preset === '7days') {
            const from = new Date(now)
            from.setDate(now.getDate() - 6)
            setDateFrom(toLocalDateStr(from))
            setDateTo(todayStr)
        } else if (preset === 'week') {
            const day = now.getDay() || 7
            const mon = new Date(now)
            mon.setDate(now.getDate() - day + 1)
            setDateFrom(toLocalDateStr(mon))
            setDateTo(todayStr)
        } else if (preset === 'month') {
            const first = new Date(now.getFullYear(), now.getMonth(), 1)
            setDateFrom(toLocalDateStr(first))
            setDateTo(todayStr)
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

        const totalPositions = active
            .filter(i => i.work_nature !== 'statistics')
            .reduce(
                (s, i) => s + (Number(i.workload_metrics?.positions_count) || 0),
                0
            )
        const totalDocuments = active
            .filter(i => i.work_nature === 'statistics')
            .reduce(
                (s, i) => s + getStatisticsDocumentCounts(i.workload_metrics).documents,
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
            totalDocuments,
            distinctDays,
        }
    }, [items])

    // Employee / Team Performance Aggregation
    const employeeStats = useMemo(() => {
        const map = new Map<string, EmployeeStatRow>()
        const empDayHoursMap = new Map<string, Map<string, { regular: number; ot: number }>>()

        const addStat = (
            keyName: string,
            type: 'member' | 'team' | 'custom',
            item: WorkPlanItem,
            ev: WorkPlanAssigneeEvaluation | null | undefined,
            sharePercent: number = 100
        ) => {
            if (item.status === 'cancelled') return
            const normKey = keyName.trim().toLowerCase()
            // Thống kê / ghi chép: không có lao động tay chân → không ghi sản lượng & giờ làm
            const isStatistics = item.work_nature === 'statistics'

            // Ghi nhận giờ làm ca chuẩn & giờ tăng ca theo ngày (bỏ qua công việc thống kê)
            if (!isStatistics) {
                const itemDate = item.plan_date || 'default_date'
                let dayMap = empDayHoursMap.get(normKey)
                if (!dayMap) {
                    dayMap = new Map<string, { regular: number; ot: number }>()
                    empDayHoursMap.set(normKey, dayMap)
                }
                const curDay = dayMap.get(itemDate) || { regular: 0, ot: 0 }
                const reg = typeof ev?.regular_hours === 'number' && !isNaN(ev.regular_hours) ? ev.regular_hours : 8
                const ot = typeof ev?.overtime_hours === 'number' && !isNaN(ev.overtime_hours) ? ev.overtime_hours : 0
                const nextReg = Math.max(curDay.regular, reg)
                const nextOt = curDay.ot + ot
                dayMap.set(itemDate, { regular: nextReg, ot: nextOt })
            }

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
                    totalWeightKg: 0,
                    totalContainers: 0,
                    totalDocuments: 0,
                    totalPenaltyPoints: 0,
                    totalBonusPoints: 0,
                    safetyPenaltyPoints: 0,
                    disciplinePenaltyPoints: 0,
                    hasSevereIncident: false,
                    incidentsCount: 0,
                    incidentsList: [],
                    primaryTasksAssigned: 0,
                    primaryTasksCompleted: 0,
                    secondaryTasksAssigned: 0,
                    secondaryTasksCompleted: 0,
                    statisticsTasksAssigned: 0,
                    statisticsTasksCompleted: 0,
                    primaryKpiScore: 0,
                    secondaryBonusPoints: 0,
                    productivityScore: 0,
                    qualityScore: 0,
                    safetyScore: 20,
                    safetyMax: 20,
                    disciplineScore: 15,
                    productivityMaxTotal: 0,
                    qualityMaxTotal: 0,
                    statisticsPrimaryTasks: 0,
                    productivityMax: 45,
                    qualityMax: 20,
                    disciplineMax: 15,
                    netKpiScore: 0,
                    weightedScore: 0,
                    totalRegularHours: 0,
                    totalOvertimeHours: 0,
                    totalWorkHours: 0,
                    speedPositionsPerHour: null,
                    speedWeightTonsPerHour: null,
                    speedPackagesPerHour: null,
                    speedSummaryText: '',
                    grade: 'B',
                    gradeLabel: 'Đạt yêu cầu',
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

            const itemTotalPos = Number(wl?.positions_count) || 0
            const itemTotalPkg = Number(wl?.packages_count) || 0
            const itemTotalKg = Number(wl?.weight_kg) || 0
            const itemTotalConts = Number(wl?.containers_count) || 0

            // Phân bổ sản lượng cá nhân theo % đóng góp
            // Công việc thống kê / ghi chép không có sản lượng tay chân
            const myPos = isStatistics ? 0 : Math.round(((itemTotalPos * sharePercent) / 100) * 10) / 10
            const myPkg = isStatistics ? 0 : Math.round((itemTotalPkg * sharePercent) / 100)
            const myKg = isStatistics ? 0 : Math.round((itemTotalKg * sharePercent) / 100)
            const myConts = isStatistics ? 0 : Math.round(((itemTotalConts * sharePercent) / 100) * 10) / 10

            if (!isStatistics) {
                row.totalPositions += myPos
                row.totalPackages += myPkg
                row.totalWeightKg += myKg
                row.totalContainers += myConts

                // Điểm quy đổi khối lượng đảm nhận trong ca
                row.weightedScore += mult * (sharePercent / 100)
            }

            // Lỗi vi phạm và thưởng của người này trong task
            let taskPenalty = 0
            let taskBonus = 0
            if (ev) {
                if (Array.isArray(ev.incidents) && ev.incidents.length > 0) {
                    ev.incidents.forEach(inc => {
                        const pen = inc.penalty_points || 0
                        taskPenalty += pen
                        row.incidentsCount += 1
                        row.incidentsList.push({
                            id: inc.id,
                            name: inc.name,
                            group: inc.group,
                            severity: inc.severity,
                            penalty_points: pen,
                            note: inc.note,
                            taskContent: item.content,
                            taskDate: item.plan_date,
                        })

                        // Nhóm lỗi → trụ khớp với engine:
                        //   Chất lượng = hàng hóa + việc tồn đọng (cả hai loại) + số liệu/ghi chép (chỉ thống kê)
                        //   An toàn    = xe nâng (chỉ lao động)
                        //   Kỷ luật    = vận hành/5S/khác + lỗi không áp dụng cho loại việc này
                        const isNoteTaking =
                            inc.type === 'missed_scan' ||
                            inc.type === 'delayed_system_update' ||
                            inc.type === 'handover_discrepancy'
                        const isDataOrNote = inc.group === 'inventory_statistics' || isNoteTaking
                        const belongsToQuality =
                            inc.group === 'quality_goods' ||
                            inc.type === 'incomplete_task' ||
                            (isStatistics && isDataOrNote)
                        if (inc.group === 'safety_forklift') {
                            if (isStatistics) row.disciplinePenaltyPoints += pen
                            else row.safetyPenaltyPoints += pen
                        } else if (!belongsToQuality) {
                            if (isDataOrNote) {
                                row.disciplinePenaltyPoints += pen
                            } else if (inc.group === 'operations' || inc.group === 'discipline_5s' || inc.group === 'other') {
                                row.disciplinePenaltyPoints += pen
                            }
                        }

                        if (inc.severity === 'severe') {
                            row.hasSevereIncident = true
                        }
                    })
                }
                taskBonus = ev.bonus_points || 0
            }

            row.totalPenaltyPoints += taskPenalty
            row.totalBonusPoints += taskBonus

            // Phân định Việc chính vs Việc phụ / Tăng cường
            const itemTaskType: WorkPlanTaskType = item.workload_metrics?.task_type || 'primary'
            const taskType: WorkPlanTaskType = ev?.task_type || itemTaskType

            // Tính điểm KPI theo chuẩn 100% (4 Trụ Cột, tiến độ không trừ oan năng suất việc làm 2 ngày)
            const taskKpi = calculateAssigneeTaskStandardKpi({
                userPositions: myPos,
                diffMultiplier: isStatistics ? 1.0 : mult,
                difficulty: wl?.difficulty,
                progressPercent: item.progress_percent || 0,
                ratingStars: item.rating_stars,
                incidents: ev?.incidents || [],
                bonusPoints: taskBonus,
                taskType,
                taskStatus: item.status,
                customProductivityScore: ev?.custom_productivity_score,
                customQualityScore: ev?.custom_quality_score,
                sharePercent: sharePercent,
                workNature: isStatistics ? 'statistics' : 'labor',
            })

            if (taskType === 'secondary') {
                row.secondaryTasksAssigned += 1
                if (item.status === 'completed') row.secondaryTasksCompleted += 1
                row.secondaryBonusPoints += taskKpi.bonusOverTargetPoints
            } else {
                row.primaryTasksAssigned += 1
                if (item.status === 'completed') row.primaryTasksCompleted += 1
                row.productivityScore += taskKpi.productivityScore
                row.qualityScore += taskKpi.qualityScore
                row.productivityMaxTotal += taskKpi.productivityMax
                row.qualityMaxTotal += taskKpi.qualityMax
                if (isStatistics) row.statisticsPrimaryTasks += 1
            }

            if (isStatistics) {
                row.totalDocuments += Math.round(
                    (getStatisticsDocumentCounts(wl).documents * sharePercent) / 100
                )
                row.statisticsTasksAssigned += 1
                if (item.status === 'completed') row.statisticsTasksCompleted += 1
            }

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
            const evals = item.workload_metrics?.assignee_evaluations || []

            if (assignees.length === 0) {
                addStat('Toàn đội kho (Chung)', 'team', item, null, 100)
            } else {
                const count = assignees.length
                assignees.forEach((a, idx) => {
                    if (!a?.name) return
                    const ev = evals.find(
                        e => e.assignee_name?.trim().toLowerCase() === a.name.trim().toLowerCase()
                    )
                    const defShare = Math.round(100 / count)
                    const fallbackShare =
                        idx === count - 1 ? 100 - defShare * (count - 1) : defShare
                    const share = ev?.share_percent ?? fallbackShare

                    addStat(a.name, a.type || 'member', item, ev, share)
                })
            }
        })

        const rows = Array.from(map.values()).map(r => {
            const sumProg = r.items.reduce((s, i) => s + (i.progress_percent || 0), 0)
            const avgProgress = r.totalAssigned > 0 ? Math.round(sumProg / r.totalAssigned) : 0
            const avgStars =
                r.ratedCount > 0 ? Number((r.totalStars / r.ratedCount).toFixed(1)) : null

            // 1. Năng suất TB Việc chính (lao động thang 45đ, thống kê thang 20đ)
            const baseTasksCount = r.primaryTasksAssigned > 0 ? r.primaryTasksAssigned : r.totalAssigned
            const prodAvg = baseTasksCount > 0 ? Math.round((r.productivityScore / baseTasksCount) * 10) / 10 : 0
            // 2. Chất lượng TB Việc chính (lao động thang 20đ, thống kê thang 40đ)
            const qualAvg = baseTasksCount > 0 ? Math.round((r.qualityScore / baseTasksCount) * 10) / 10 : 0
            const prodMax =
                baseTasksCount > 0 && r.productivityMaxTotal > 0
                    ? Math.round((r.productivityMaxTotal / baseTasksCount) * 10) / 10
                    : 45
            const qualMax =
                baseTasksCount > 0 && r.qualityMaxTotal > 0
                    ? Math.round((r.qualityMaxTotal / baseTasksCount) * 10) / 10
                    : 20
            // 3. An toàn lao động (gốc 20đ, trừ lỗi xe nâng) — việc thống kê không có trụ này
            const isStatisticsOnly =
                r.statisticsPrimaryTasks > 0 && r.statisticsPrimaryTasks === r.primaryTasksAssigned
            const safetyMax = isStatisticsOnly ? 0 : 20
            const safeScore = isStatisticsOnly ? 0 : Math.max(0, 20 - r.safetyPenaltyPoints)
            // 4. Kỷ luật & 5S (lao động gốc 15đ, thống kê gốc 20đ; trừ lỗi + cộng thưởng)
            const discBase = isStatisticsOnly ? 20 : 15
            const discScore = Math.min(20, Math.max(0, discBase - r.disciplinePenaltyPoints + r.totalBonusPoints))

            // ĐIỂM VIỆC CHÍNH (Chuẩn 100 điểm)
            const rawPrimaryKpi = prodAvg + qualAvg + safeScore + discScore
            const primaryKpiScore = Math.min(110, Math.round(rawPrimaryKpi * 10) / 10)

            // ĐIỂM VIỆC PHỤ / LÀM THÊM (MỞ TRẦN CỘNG DỒN)
            const secondaryBonusPoints = Math.round(r.secondaryBonusPoints * 10) / 10

            // TỔNG ĐIỂM KPI (Có thể đạt 120đ, 150đ, 180đ+)
            const netKpiScore = Math.round((primaryKpiScore + secondaryBonusPoints) * 10) / 10

            // Xếp loại danh hiệu Bé Khỏe Bé Ngoan (Thang ca chuẩn 100đ + Việc phụ mở trần)
            let grade: 'A+' | 'A' | 'B' | 'C' = 'B'
            let gradeLabel = '🌱 Cần Cố Gắng (B)'
            if (r.hasSevereIncident || (!isStatisticsOnly && safeScore <= 5) || primaryKpiScore < 70) {
                grade = 'C'
                gradeLabel = r.hasSevereIncident ? '⚠️ Chưa Ngoan (Sự cố)' : '⚠️ Chưa Ngoan (C)'
            } else if (netKpiScore >= 100) {
                grade = 'A+'
                gradeLabel = '🌸 Bé Khỏe Bé Ngoan (A+)'
            } else if (netKpiScore >= 85) {
                grade = 'A'
                gradeLabel = '⭐ Bé Ngoan (A)'
            } else if (netKpiScore >= 70) {
                grade = 'B'
                gradeLabel = '🌱 Cần Cố Gắng (B)'
            } else {
                grade = 'C'
                gradeLabel = '⚠️ Chưa Ngoan (C)'
            }

            // TÍNH TOÁN GIỜ LÀM VIỆC & TỐC ĐỘ NĂNG SUẤT THEO GIỜ
            const normKey = r.name.trim().toLowerCase()
            const dayMap = empDayHoursMap.get(normKey)
            let totalRegularHours = 0
            let totalOvertimeHours = 0
            if (dayMap) {
                dayMap.forEach(d => {
                    totalRegularHours += d.regular
                    totalOvertimeHours += d.ot
                })
            }
            totalRegularHours = Math.round(totalRegularHours * 10) / 10
            totalOvertimeHours = Math.round(totalOvertimeHours * 10) / 10
            const totalWorkHours = Math.round((totalRegularHours + totalOvertimeHours) * 10) / 10

            const speedInfo = calculateWorkSpeed({
                positions: r.totalPositions,
                weightKg: r.totalWeightKg,
                packages: r.totalPackages,
                regularHours: totalRegularHours,
                overtimeHours: totalOvertimeHours,
            })

            return {
                ...r,
                avgProgress,
                avgStars,
                productivityScore: prodAvg,
                qualityScore: qualAvg,
                safetyScore: safeScore,
                safetyMax,
                disciplineScore: discScore,
                productivityMax: prodMax,
                qualityMax: qualMax,
                disciplineMax: discBase,
                primaryKpiScore,
                secondaryBonusPoints,
                totalPositions: Math.round(r.totalPositions * 10) / 10,
                totalContainers: Math.round(r.totalContainers * 10) / 10,
                weightedScore: Math.round(r.weightedScore * 10) / 10,
                totalRegularHours,
                totalOvertimeHours,
                totalWorkHours,
                speedPositionsPerHour: speedInfo.positionsPerHour,
                speedWeightTonsPerHour: speedInfo.weightTonsPerHour,
                speedPackagesPerHour: speedInfo.packagesPerHour,
                speedSummaryText: speedInfo.speedSummaryText,
                netKpiScore,
                grade,
                gradeLabel,
            }
        })

        rows.sort(
            (a, b) =>
                b.netKpiScore - a.netKpiScore ||
                b.secondaryBonusPoints - a.secondaryBonusPoints ||
                b.primaryKpiScore - a.primaryKpiScore ||
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

            // Sheet 1: Bảng Hiệu Suất & KPI Nhân Sự
            const wsEmp = workbook.addWorksheet('Hiệu suất & KPI Nhân viên')
            wsEmp.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Nhân viên / Tổ đội', key: 'name', width: 28 },
                { header: 'Phân loại', key: 'type', width: 15 },
                { header: '⭐ Việc chính đã giao', key: 'primaryAssigned', width: 20 },
                { header: '⭐ Việc chính hoàn thành', key: 'primaryCompleted', width: 22 },
                { header: '➕ Việc phụ hỗ trợ', key: 'secondaryTasks', width: 18 },
                { header: '📊 Việc thống kê', key: 'statisticsTasks', width: 18 },
                { header: '📄 Số phiếu đã tạo', key: 'documents', width: 18 },
                { header: 'Tổng vị trí cá nhân (vt)', key: 'positions', width: 20 },
                { header: 'Tổng khối lượng (Kg)', key: 'weightKg', width: 20 },
                { header: '⏱️ Giờ chuẩn (h)', key: 'regularHours', width: 16 },
                { header: '⚡ Tăng ca OT (h)', key: 'overtimeHours', width: 16 },
                { header: '⏱️ Tổng giờ làm (h)', key: 'totalHours', width: 18 },
                { header: '⚡ Năng suất việc chính (đ)', key: 'prodScore', width: 24 },
                { header: '⭐ Chất lượng (đ)', key: 'qualScore', width: 18 },
                { header: '🛡️ An toàn (đ)', key: 'safeScore', width: 18 },
                { header: '📋 Kỷ luật & 5S (đ)', key: 'discScore', width: 20 },
                { header: '🎯 Điểm Việc Chính (/100đ)', key: 'primaryKpi', width: 24 },
                { header: '➕ Điểm Việc Phụ (+đ)', key: 'secondaryBonus', width: 22 },
                { header: '⚠️ Lỗi vi phạm', key: 'incidentsCount', width: 16 },
                { header: 'Điểm phạt (-đ)', key: 'penalty', width: 16 },
                { header: '🏆 TỔNG ĐIỂM KPI (Mở trần)', key: 'netKpi', width: 28 },
                { header: 'Tiến độ TB (%)', key: 'avgProgress', width: 16 },
                { header: 'Xếp loại thi đua', key: 'grade', width: 22 },
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
                    primaryAssigned: emp.primaryTasksAssigned,
                    primaryCompleted: emp.primaryTasksCompleted,
                    secondaryTasks: `${emp.secondaryTasksCompleted} / ${emp.secondaryTasksAssigned}`,
                    statisticsTasks: `${emp.statisticsTasksCompleted} / ${emp.statisticsTasksAssigned}`,
                    documents: emp.totalDocuments > 0 ? emp.totalDocuments : '-',
                    positions: emp.totalPositions || '-',
                    weightKg: emp.totalWeightKg > 0 ? emp.totalWeightKg : '-',
                    regularHours: emp.totalRegularHours > 0 ? `${emp.totalRegularHours}h` : '-',
                    overtimeHours: emp.totalOvertimeHours > 0 ? `+${emp.totalOvertimeHours}h` : '-',
                    totalHours: emp.totalWorkHours > 0 ? `${emp.totalWorkHours}h` : '-',
                    prodScore: `${emp.productivityScore} / ${emp.productivityMax}đ`,
                    qualScore: `${emp.qualityScore} / ${emp.qualityMax}đ`,
                    safeScore: emp.safetyMax === 0 ? '—' : `${emp.safetyScore} / ${emp.safetyMax}đ`,
                    discScore: `${emp.disciplineScore} / ${emp.disciplineMax}đ`,
                    primaryKpi: `${emp.primaryKpiScore} / 100đ`,
                    secondaryBonus: emp.secondaryBonusPoints > 0 ? `+${emp.secondaryBonusPoints}đ` : '0đ',
                    incidentsCount: emp.incidentsCount || 0,
                    penalty: emp.totalPenaltyPoints ? `-${emp.totalPenaltyPoints}đ` : '-',
                    netKpi: `${emp.netKpiScore} điểm`,
                    avgProgress: `${emp.avgProgress}%`,
                    grade: emp.gradeLabel || emp.grade,
                })
            })

            // Sheet 2: Chi Tiết Công Việc & Đánh Giá
            const wsDetail = workbook.addWorksheet('Chi tiết Kế hoạch & Đánh giá')
            wsDetail.columns = [
                { header: 'Ngày', key: 'date', width: 14 },
                { header: 'STT Ngày', key: 'order', width: 10 },
                { header: 'Nội dung công việc', key: 'content', width: 45 },
                { header: 'Người / Đội phụ trách', key: 'assignees', width: 28 },
                { header: 'Đánh giá & Vi phạm cá nhân', key: 'individualEval', width: 45 },
                { header: 'Độ nặng/nhẹ', key: 'difficulty', width: 16 },
                { header: 'Số vị trí', key: 'positions', width: 12 },
                { header: 'Số lượng & Nguồn gắn', key: 'workload', width: 38 },
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
                
                const evals = wl?.assignee_evaluations || []
                const evalText = evals.map(e => {
                    const parts: string[] = [`${e.assignee_name} (${e.share_percent}%)`]
                    if (e.incidents && e.incidents.length > 0) {
                        parts.push(`Lỗi: ${e.incidents.map(i => `${i.name} (-${i.penalty_points}đ)`).join(', ')}`)
                    }
                    if (e.bonus_points) {
                        parts.push(`Thưởng: +${e.bonus_points}đ`)
                    }
                    return parts.join(' - ')
                }).join('; ')

                wsDetail.addRow({
                    date: formatVNDateSlash(item.plan_date),
                    order: item.sort_order,
                    content: item.content,
                    assignees: Array.isArray(item.assignees)
                        ? item.assignees.map(a => a.name).join(', ')
                        : '',
                    individualEval: evalText || '-',
                    difficulty: diffLabel,
                    positions: wl?.positions_count || '-',
                    workload: formatWorkloadSummaryText(wl, item.work_nature) || '-',
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
            saveAs(blob, `BaoCao_KeHoach_KPI_DanhGiaCV_${dateFrom}_${dateTo}.xlsx`)
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
                                { id: 'today', label: 'Hôm nay' },
                                { id: 'yesterday', label: 'Hôm qua' },
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

                <div className="flex items-center gap-2">
                    <a
                        href="/work/rules"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
                        title="Xem bộ quy tắc chấm điểm, thưởng phạt và xếp loại KPI"
                    >
                        <BookOpen size={15} className="text-amber-600" />
                        <span>Quy Chế KPI</span>
                    </a>

                    <button
                        type="button"
                        disabled={items.length === 0}
                        onClick={() => setShowExportZaloModal(true)}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all"
                        title="Tạo ảnh bảng xếp hạng sắc nét gửi vào nhóm Zalo"
                    >
                        <Camera size={15} />
                        Xuất Phiếu / Ảnh Zalo
                    </button>

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
                        {kpis.totalDocuments > 0 && (
                            <span className="block text-sky-700 font-bold mt-0.5">
                                📄 {kpis.totalDocuments.toLocaleString('vi-VN')} phiếu thống kê đã tạo
                            </span>
                        )}
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
                            <h3 className="text-sm md:text-base font-bold text-stone-800 flex items-center gap-1.5">
                                <span>🌸 Bảng Phong Thần Thi Đua Bé Khỏe Bé Ngoan</span>
                            </h3>
                            <p className="text-xs text-stone-500">
                                Đo lường năng suất (Bé Khỏe ⚡) & An toàn, kỷ luật 5S (Bé Ngoan 🛡️)
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
                                    <th className="px-2 py-3 text-center w-10">Hạng</th>
                                    <th className="px-3 py-3 text-left">Nhân viên / Tổ đội</th>
                                    <th className="px-2.5 py-3 text-center" title="Số việc chính được giao trong ca và tỷ lệ hoàn tất">⭐ Việc chính</th>
                                    <th className="px-2.5 py-3 text-center" title="Số việc phụ / tăng cường được hỗ trợ">➕ Việc phụ</th>
                                    <th className="px-2.5 py-3 text-center" title="Sản lượng thực tế, số giờ làm và tốc độ năng suất trong 1 giờ. Công việc Thống kê / Ghi chép không được ghi vào cột này.">Sản Lượng & Giờ Làm</th>
                                    <th className="px-2 py-3 text-center" title="Nhóm điểm Năng suất: Lao động 35–45đ (Nhẹ 35, Vừa 37, Nặng 40, Rất nặng 45) • Thống kê 30–40đ theo độ nặng (không có nhóm An toàn)">⚡ N.Suất</th>
                                    <th className="px-2 py-3 text-center" title="Nhóm điểm Chất lượng thực hiện việc chính (Tối đa 20đ)">⭐ C.Lượng</th>
                                    <th className="px-2 py-3 text-center" title="Nhóm điểm An toàn lao động (Gốc 20đ, chỉ trừ lỗi vận hành xe nâng)">🛡️ A.Toàn</th>
                                    <th className="px-2 py-3 text-center" title="Nhóm điểm Kỷ luật & 5S (lao động gốc 15đ, thống kê gốc 20đ; trừ lỗi + thưởng)">📋 K.Luật</th>
                                    <th className="px-3 py-3 text-center" title="Điểm việc chính theo thang chuẩn 100đ">⭐ Điểm Chính</th>
                                    <th className="px-3 py-3 text-center" title="Điểm việc phụ cộng thêm không giới hạn trần">➕ Việc Phụ</th>
                                    <th className="px-3 py-3 text-center" title="Tổng KPI thực tế mở trần (có thể đạt 120đ - 150đ+)">🎯 TỔNG KPI</th>
                                    <th className="px-3 py-3 text-center">Xếp loại</th>
                                    <th className="px-3 py-3 text-right">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {employeeStats.map((row, idx) => (
                                    <tr
                                        key={row.name}
                                        className="hover:bg-indigo-50/30 transition-colors"
                                    >
                                        <td className="px-2 py-3 text-center font-black text-stone-500">
                                            #{idx + 1}
                                        </td>
                                        <td className="px-3 py-3">
                                            <div className="font-bold text-stone-900 flex items-center gap-1.5">
                                                <span>{row.name}</span>
                                                {row.hasSevereIncident && (
                                                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse inline-block" title="Có lỗi vi phạm an toàn nghiêm trọng" />
                                                )}
                                                {row.statisticsTasksAssigned > 0 && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-extrabold"
                                                        title="Công việc Thống kê / Ghi chép: chấm độ chính xác & hoàn thành trong ngày, không ghi sản lượng & giờ làm"
                                                    >
                                                        📊 {row.statisticsTasksAssigned} thống kê
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-stone-500">
                                                {row.type === 'team'
                                                    ? 'Tổ / Đội vận hành'
                                                    : 'Nhân viên thực hiện'}
                                            </div>
                                        </td>
                                        {/* ⭐ Việc chính */}
                                        <td className="px-2.5 py-3 text-center font-bold text-stone-800">
                                            <span className="text-emerald-700 font-extrabold">{row.primaryTasksCompleted}</span>
                                            <span className="text-stone-400 font-normal"> / {row.primaryTasksAssigned}</span>
                                        </td>
                                        {/* ➕ Việc phụ */}
                                        <td className="px-2.5 py-3 text-center font-bold">
                                            {row.secondaryTasksAssigned > 0 ? (
                                                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black">
                                                    +{row.secondaryTasksCompleted}/{row.secondaryTasksAssigned}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-300">-</span>
                                            )}
                                        </td>
                                        {/* Sản lượng & Giờ làm / Tốc độ */}
                                        <td className="px-2.5 py-3 text-center">
                                            <div className="flex flex-col items-center gap-0.5">
                                                {row.totalPositions > 0 && (
                                                    <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                                                        📍 {row.totalPositions} vt
                                                    </span>
                                                )}
                                                {row.totalWeightKg > 0 && (
                                                    <span className="text-[10px] text-stone-500 font-medium">
                                                        ⚖️ {(row.totalWeightKg / 1000).toFixed(1)} tấn
                                                    </span>
                                                )}
                                                {row.totalWorkHours > 0 && (
                                                    <span
                                                        className="text-[10px] text-indigo-700 font-bold bg-indigo-50/70 border border-indigo-100 px-1.5 py-0.2 rounded mt-0.5"
                                                        title={`Tổng ${row.totalWorkHours}h làm (${row.totalRegularHours}h ca chuẩn + ${row.totalOvertimeHours}h OT)`}
                                                    >
                                                        ⏱️ {row.totalWorkHours}h {row.totalOvertimeHours > 0 && `(+${row.totalOvertimeHours}h OT)`}
                                                    </span>
                                                )}
                                                {row.totalPositions === 0 && row.totalWeightKg === 0 && row.totalWorkHours === 0 && (
                                                    row.statisticsTasksAssigned > 0 ? (
                                                        <span className="px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold" title="Công việc thống kê / ghi chép không ghi sản lượng & giờ làm">
                                                            {row.totalDocuments > 0
                                                                ? `📄 ${row.totalDocuments.toLocaleString('vi-VN')} phiếu đã tạo`
                                                                : '📊 Không ghi (thống kê)'}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-stone-300">-</span>
                                                    )
                                                )}
                                                {row.statisticsTasksAssigned > 0 && row.totalDocuments > 0 && (row.totalPositions > 0 || row.totalWeightKg > 0 || row.totalWorkHours > 0) && (
                                                    <span className="text-[10px] text-sky-700 font-bold" title="Số phiếu / chứng từ đã tạo của việc thống kê">
                                                        📄 {row.totalDocuments.toLocaleString('vi-VN')} phiếu (thống kê)
                                                    </span>
                                                )}
                                                {row.statisticsTasksAssigned > 0 && (row.totalPositions > 0 || row.totalWeightKg > 0 || row.totalWorkHours > 0) && (
                                                    <span className="text-[9px] text-sky-700 font-semibold" title="Chỉ tính các việc lao động; việc thống kê không ghi sản lượng/giờ">
                                                        📊 {row.statisticsTasksAssigned} việc thống kê không tính
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {/* Trụ Cột 1: Năng Suất (lao động /45đ, thống kê /40đ) */}
                                        <td className="px-2 py-3 text-center font-bold text-stone-800">
                                            <span
                                                title={`Năng suất: ${row.productivityScore}/${row.productivityMax}đ`}
                                                className={`px-1.5 py-0.5 rounded-md text-xs ${
                                                    row.productivityScore >= row.productivityMax * 0.8
                                                        ? 'bg-emerald-50 text-emerald-800 font-black'
                                                        : 'bg-stone-50 text-stone-700'
                                                }`}
                                            >
                                                {row.productivityScore}
                                            </span>
                                        </td>
                                        {/* Trụ Cột 2: Chất Lượng (lao động /20đ, thống kê /40đ) */}
                                        <td className="px-2 py-3 text-center font-bold text-amber-700">
                                            <span
                                                title={`Chất lượng: ${row.qualityScore}/${row.qualityMax}đ`}
                                                className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 text-xs"
                                            >
                                                {row.qualityScore}
                                            </span>
                                        </td>
                                        {/* Nhóm điểm 3: An Toàn (/20đ) — việc thống kê không có nhóm này */}
                                        <td className="px-2 py-3 text-center">
                                            {row.safetyMax === 0 ? (
                                                <span className="text-stone-300 font-bold text-xs" title="Việc thống kê không vận hành xe nâng nên không có nhóm An toàn; 20đ đã dồn sang Năng suất">—</span>
                                            ) : (
                                                <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${
                                                    row.safetyScore < row.safetyMax
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200 font-black'
                                                        : 'bg-emerald-50 text-emerald-700'
                                                }`}>
                                                    {row.safetyScore}
                                                    {row.safetyPenaltyPoints > 0 && (
                                                        <span className="text-[10px] text-rose-600 block font-normal">(-{row.safetyPenaltyPoints})</span>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        {/* Trụ Cột 4: Kỷ Luật & 5S (lao động /15đ, thống kê /20đ) */}
                                        <td className="px-2 py-3 text-center">
                                            <span
                                                title={`Kỷ luật & 5S: ${row.disciplineScore}/${row.disciplineMax}đ`}
                                                className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold"
                                            >
                                                {row.disciplineScore}
                                                {row.totalBonusPoints > 0 && (
                                                    <span className="text-[10px] text-emerald-600 block font-bold">(+{row.totalBonusPoints})</span>
                                                )}
                                            </span>
                                        </td>
                                        {/* ⭐ ĐIỂM VIỆC CHÍNH (/100đ chuẩn) */}
                                        <td className="px-3 py-3 text-center">
                                            <span className="px-2 py-0.5 rounded-lg bg-stone-100 text-stone-800 text-xs font-black">
                                                {row.primaryKpiScore} <span className="text-[10px] text-stone-400 font-normal">/100đ</span>
                                            </span>
                                        </td>
                                        {/* ➕ ĐIỂM VIỆC PHỤ (+đ mở trần) */}
                                        <td className="px-3 py-3 text-center">
                                            {row.secondaryBonusPoints > 0 ? (
                                                <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black shadow-2xs">
                                                    +{row.secondaryBonusPoints}đ
                                                </span>
                                            ) : (
                                                <span className="text-xs text-stone-300">-</span>
                                            )}
                                        </td>
                                        {/* 🎯 TỔNG ĐIỂM KPI (MỞ TRẦN ĐẠT 120-150đ+) */}
                                        <td className="px-3 py-3 text-center">
                                            <span
                                                className={`px-2.5 py-1 rounded-xl text-white text-xs font-black shadow-xs inline-flex items-center gap-1 ${
                                                    row.netKpiScore >= 120
                                                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 animate-pulse'
                                                        : row.netKpiScore >= 100
                                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
                                                        : 'bg-gradient-to-r from-indigo-600 to-indigo-700'
                                                }`}
                                                title={`Tổng KPI = Điểm Việc Chính (${row.primaryKpiScore}đ) + Thưởng Việc Phụ (+${row.secondaryBonusPoints}đ)`}
                                            >
                                                <Target size={12} />
                                                {row.netKpiScore} đ
                                            </span>
                                        </td>
                                        {/* Xếp Loại */}
                                        <td className="px-3 py-3 text-center">
                                            <span
                                                className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black border shadow-2xs ${
                                                    row.grade === 'A+'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
                                                        : row.grade === 'A'
                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                        : row.grade === 'B'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-stone-100 text-stone-600 border-stone-300'
                                                }`}
                                            >
                                                {row.gradeLabel || `Hạng ${row.grade}`}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-right">
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
                                                    ? 'Đóng chi tiết ✕'
                                                    : 'Xem việc & điểm số ▾'}
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
                    <div className="p-4 bg-indigo-50/40 border-t border-indigo-100 space-y-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex flex-wrap items-center gap-2">
                                    <span>Bảng Đánh Giá KPI Nhân Sự: {selectedEmployee.name}</span>
                                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white text-xs font-black shadow-xs">
                                        🎯 TỔNG KPI: {selectedEmployee.netKpiScore} ĐIỂM ({selectedEmployee.gradeLabel})
                                    </span>
                                </h4>
                                <p className="text-[11px] text-stone-500 mt-0.5">
                                    ⭐ Việc chính: <b>{selectedEmployee.primaryTasksCompleted}/{selectedEmployee.primaryTasksAssigned}</b> (Đạt {selectedEmployee.primaryKpiScore}/100đ chuẩn) • ➕ Việc phụ hỗ trợ: <b>{selectedEmployee.secondaryTasksCompleted}/{selectedEmployee.secondaryTasksAssigned}</b> (+{selectedEmployee.secondaryBonusPoints}đ) • Tổng sản lượng: <b>{selectedEmployee.totalPositions} vị trí</b> ({selectedEmployee.totalWeightKg.toLocaleString('vi-VN')} kg) • ⏱️ Giờ làm: <b>{selectedEmployee.totalWorkHours}h</b> ({selectedEmployee.totalRegularHours}h chuẩn{selectedEmployee.totalOvertimeHours > 0 ? ` + ${selectedEmployee.totalOvertimeHours}h OT` : ''})
                                    {selectedEmployee.statisticsTasksAssigned > 0 && (
                                        <span className="text-sky-700 font-semibold">
                                            {' '}• 📊 <b>{selectedEmployee.statisticsTasksCompleted}/{selectedEmployee.statisticsTasksAssigned}</b> việc thống kê
                                            {selectedEmployee.totalDocuments > 0 && (
                                                <> • 📄 <b>{selectedEmployee.totalDocuments.toLocaleString('vi-VN')}</b> phiếu đã tạo</>
                                            )}
                                            {' '}(không ghi sản lượng & giờ làm)
                                        </span>
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEmployee(null)}
                                className="text-xs font-semibold text-stone-500 hover:text-stone-800"
                            >
                                Đóng chi tiết ✕
                            </button>
                        </div>

                        {/* Thẻ hiển thị Điểm Việc Chính (3 Trụ Cột cho thống kê / 4 Trụ Cột cho lao động) & Việc Phụ Cộng Thêm */}
                        <div className={`grid grid-cols-2 ${selectedEmployee.safetyMax === 0 ? 'md:grid-cols-4' : 'md:grid-cols-5'} gap-2.5`}>
                            <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-stone-500 uppercase">⚡ N.Suất Việc Chính ({selectedEmployee.safetyMax === 0 ? 'mốc 30–40 / trần 40đ' : '35–45đ'})</div>
                                <div className="text-lg font-black text-stone-900 mt-1">{selectedEmployee.productivityScore} <span className="text-xs text-stone-400 font-normal">/ {selectedEmployee.productivityMax} đ</span></div>
                                <div className="text-[10px] text-stone-500 mt-0.5">
                                    {selectedEmployee.safetyMax === 0
                                        ? 'Việc thống kê: Nhẹ 30 • Vừa 32 • Nặng 35 • Rất nặng 40 × % hoàn thành'
                                        : 'Nhẹ 35 • Vừa 37 • Nặng 40 • Rất nặng 45'}
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-stone-500 uppercase">⭐ Chất Lượng (Max {selectedEmployee.qualityMax})</div>
                                <div className="text-lg font-black text-amber-700 mt-1">{selectedEmployee.qualityScore} <span className="text-xs text-amber-600 font-normal">/ {selectedEmployee.qualityMax} đ</span></div>
                                <div className="text-[10px] text-stone-500 mt-0.5">Không lỗi hàng hóa / số liệu = tối đa; trừ theo lỗi</div>
                            </div>
                            {selectedEmployee.safetyMax > 0 && (
                                <div className={`p-3 rounded-xl border shadow-2xs ${selectedEmployee.safetyScore < selectedEmployee.safetyMax ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-200'}`}>
                                    <div className={`text-[10px] font-bold uppercase ${selectedEmployee.safetyScore < selectedEmployee.safetyMax ? 'text-rose-700' : 'text-stone-500'}`}>
                                        🛡️ An Toàn (Gốc {selectedEmployee.safetyMax})
                                    </div>
                                    <div className={`text-lg font-black mt-1 ${selectedEmployee.safetyScore < selectedEmployee.safetyMax ? 'text-rose-700' : 'text-emerald-700'}`}>
                                        {selectedEmployee.safetyScore} <span className="text-xs opacity-70 font-normal">/ {selectedEmployee.safetyMax} đ</span>
                                    </div>
                                    <div className="text-[10px] text-stone-500 mt-0.5">
                                        {selectedEmployee.safetyPenaltyPoints > 0 ? `Trừ -${selectedEmployee.safetyPenaltyPoints}đ lỗi an toàn` : '✓ Tuyệt đối an toàn'}
                                    </div>
                                </div>
                            )}
                            <div className="p-3 rounded-xl bg-white border border-stone-200 shadow-2xs">
                                <div className="text-[10px] font-bold text-stone-500 uppercase">📋 Kỷ Luật & 5S (Gốc {selectedEmployee.disciplineMax})</div>
                                <div className="text-lg font-black text-indigo-700 mt-1">{selectedEmployee.disciplineScore} <span className="text-xs text-indigo-400 font-normal">/ {selectedEmployee.disciplineMax} đ</span></div>
                                <div className="text-[10px] text-stone-500 mt-0.5">
                                    {selectedEmployee.totalBonusPoints > 0 ? `+${selectedEmployee.totalBonusPoints}đ thưởng công hiến` : '✓ Tuân thủ nội quy ca'}
                                </div>
                            </div>
                            {/* Thẻ Việc Phụ / Tăng Cường (Mở Trần) */}
                            <div className={`p-3 rounded-xl border shadow-2xs ${selectedEmployee.secondaryBonusPoints > 0 ? 'bg-purple-50/80 border-purple-200' : 'bg-white border-stone-200'}`}>
                                <div className="text-[10px] font-bold text-purple-900 uppercase">➕ Việc Phụ / Tăng Cường</div>
                                <div className="text-lg font-black text-purple-700 mt-1">
                                    +{selectedEmployee.secondaryBonusPoints} <span className="text-xs text-purple-400 font-normal">điểm</span>
                                </div>
                                <div className="text-[10px] text-purple-600 mt-0.5 font-medium">
                                    {selectedEmployee.secondaryTasksCompleted} việc phụ hoàn tất (Mở trần)
                                </div>
                            </div>
                        </div>

                        {selectedEmployee.hasSevereIncident && (
                            <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900 flex items-center gap-2">
                                <ShieldAlert size={16} className="text-rose-700 shrink-0" />
                                <span>Nhân sự có lỗi vi phạm an toàn nghiêm trọng trong kỳ $\rightarrow$ Bị khóa xếp loại Hạng C theo quy chế an toàn lao động.</span>
                            </div>
                        )}

                        {/* Hộp cảnh báo sự cố / vi phạm nếu có */}
                        {selectedEmployee.incidentsList.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-black text-rose-900 uppercase">
                                    <ShieldAlert size={15} className="text-rose-600" />
                                    <span>
                                        Lịch sử Vi Phạm & Điểm Trừ Trong Kỳ ({selectedEmployee.incidentsCount} lỗi vi phạm • Tổng trừ -{selectedEmployee.totalPenaltyPoints} điểm)
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {selectedEmployee.incidentsList.map((inc, i) => (
                                        <div
                                            key={inc.id || i}
                                            className="p-2.5 bg-white rounded-lg border border-rose-200 text-xs flex items-start justify-between gap-2 shadow-2xs"
                                        >
                                            <div className="space-y-0.5">
                                                <div className="font-bold text-stone-900 flex items-center gap-1">
                                                    <span className="text-rose-700">⚠️ {inc.name}</span>
                                                </div>
                                                <div className="text-[11px] text-stone-500">
                                                    Ngày: <span className="font-bold text-stone-700">{formatVNDateSlash(inc.taskDate)}</span>
                                                </div>
                                                <div className="text-[11px] text-stone-600 italic line-clamp-1">
                                                    Đầu việc: {inc.taskContent}
                                                </div>
                                            </div>
                                            <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs shrink-0">
                                                -{inc.penalty_points}đ
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Danh sách từng công việc cụ thể */}
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                            {selectedEmployee.items.map(item => {
                                const st = ITEM_STATUS_CONFIG[item.status]
                                const rt = item.rating ? RATING_CONFIG[item.rating] : null
                                const wlText = formatWorkloadSummaryText(
                                    item.workload_metrics,
                                    item.work_nature
                                )

                                // Tìm đánh giá cá nhân cho nhân viên này trong task
                                const evals = item.workload_metrics?.assignee_evaluations || []
                                const myEval = evals.find(
                                    e => e.assignee_name?.trim().toLowerCase() === selectedEmployee.name.trim().toLowerCase()
                                )

                                const itemMult = DIFFICULTY_CONFIG[item.workload_metrics?.difficulty || 'medium']?.multiplier || 1.0
                                const isStatisticsTask = item.work_nature === 'statistics'
                                const itemTotalPos = isStatisticsTask ? 0 : Number(item.workload_metrics?.positions_count) || 0
                                const itemTotalKg = isStatisticsTask ? 0 : Number(item.workload_metrics?.weight_kg) || 0
                                const itemDocs = isStatisticsTask
                                    ? getStatisticsDocumentCounts(item.workload_metrics).documents
                                    : 0
                                const itemShare = myEval?.share_percent ?? 100
                                const userPos = Math.round(((itemTotalPos * itemShare) / 100) * 10) / 10
                                const userKg = Math.round((itemTotalKg * itemShare) / 100)
                                const isSecondaryTask = myEval?.task_type === 'secondary' || item.workload_metrics?.task_type === 'secondary'

                                const taskKpi = calculateAssigneeTaskStandardKpi({
                                    userPositions: userPos,
                                    diffMultiplier: isStatisticsTask ? 1.0 : itemMult,
                                    difficulty: item.workload_metrics?.difficulty,
                                    progressPercent: item.progress_percent || 0,
                                    ratingStars: item.rating_stars,
                                    incidents: myEval?.incidents || [],
                                    bonusPoints: myEval?.bonus_points || 0,
                                    taskType: isSecondaryTask ? 'secondary' : 'primary',
                                    taskStatus: item.status,
                                    customProductivityScore: myEval?.custom_productivity_score,
                                    customQualityScore: myEval?.custom_quality_score,
                                    sharePercent: itemShare,
                                    workNature: item.work_nature,
                                })

                                return (
                                    <div
                                        key={item.id}
                                        className="p-3 rounded-xl bg-white border border-stone-200 space-y-2 shadow-2xs hover:border-indigo-200 transition-colors"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="font-bold text-stone-900 flex flex-wrap items-center gap-1.5">
                                                <span className="text-indigo-600 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                    📅 {formatVNDateSlash(item.plan_date)}
                                                </span>
                                                <span className="text-sm font-black">#{item.sort_order}. {item.content}</span>
                                                {isSecondaryTask ? (
                                                    <span className="px-1.5 py-0.2 rounded-md bg-purple-100 text-purple-800 font-extrabold text-[10px] border border-purple-200">
                                                        ➕ Việc phụ (+đ)
                                                    </span>
                                                ) : (
                                                    <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 font-extrabold text-[10px] border border-amber-200">
                                                        ⭐ Việc chính
                                                    </span>
                                                )}
                                                {isStatisticsTask && (
                                                    <span
                                                        className="px-1.5 py-0.2 rounded-md bg-sky-50 text-sky-800 font-extrabold text-[10px] border border-sky-200"
                                                        title="Công việc thống kê / ghi chép: không ghi sản lượng & giờ làm, chấm độ chính xác & hoàn thành trong ngày"
                                                    >
                                                        📊 Thống kê
                                                    </span>
                                                )}
                                            </div>

                                            {/* Tổng Điểm KPI của Công Việc Này */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={`px-2 py-0.5 rounded-md font-bold text-xs ${st.bgClass} ${st.textClass}`}>
                                                    {st.shortLabel} ({item.progress_percent}%)
                                                </span>
                                                {isSecondaryTask ? (
                                                    <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 font-black text-xs border border-purple-200 shadow-2xs">
                                                        Thưởng: +{taskKpi.bonusOverTargetPoints}đ
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs border border-indigo-200 shadow-2xs">
                                                        KPI việc: {taskKpi.totalKpi}/100đ ({taskKpi.grade})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Chi tiết khối lượng đảm nhận & Bảng 4 Trụ Cột của việc này */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[11px]">
                                            <div className="flex flex-wrap items-center gap-2 text-stone-600">
                                                <span className="font-bold text-stone-800">
                                                    Đóng góp: {itemShare}%
                                                </span>
                                                {isStatisticsTask ? (
                                                    <span className="text-sky-700 font-medium bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                                                        {itemDocs > 0
                                                            ? `📄 ${itemDocs.toLocaleString('vi-VN')} phiếu đã tạo`
                                                            : '📄 Chưa nhập số phiếu — không ghi sản lượng & giờ làm'}
                                                    </span>
                                                ) : (
                                                    (userPos > 0 || userKg > 0) && (
                                                        <span className="text-amber-700 font-medium bg-amber-50/80 px-1.5 py-0.2 rounded border border-amber-200">
                                                            📦 {userPos} vị trí • {userKg.toLocaleString('vi-VN')} kg
                                                        </span>
                                                    )
                                                )}
                                                {wlText && !isStatisticsTask && (
                                                    <span className="text-stone-400 text-[10px] hidden lg:inline">
                                                        (Toàn việc: {wlText})
                                                    </span>
                                                )}
                                            </div>

                                            {/* Chi tiết 4 Trụ Cột của việc này */}
                                            <div className="flex flex-wrap items-center gap-1.5 font-bold">
                                                <span className="px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200 text-stone-700">
                                                    ⚡ N.Suất: <b className="text-stone-900">{taskKpi.productivityScore}/{taskKpi.productivityMax}đ</b>
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200 text-stone-700">
                                                    ⭐ C.Lượng: <b className="text-amber-700">{taskKpi.qualityScore}/{taskKpi.qualityMax}đ</b>
                                                </span>
                                                {taskKpi.safetyMax > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200 text-stone-700">
                                                        🛡️ A.Toàn: <b className={taskKpi.safetyScore < taskKpi.safetyMax ? 'text-rose-600' : 'text-emerald-700'}>{taskKpi.safetyScore}/{taskKpi.safetyMax}đ</b>
                                                    </span>
                                                )}
                                                <span className="px-1.5 py-0.5 rounded bg-stone-50 border border-stone-200 text-stone-700">
                                                    📋 Kỷ luật: <b className="text-indigo-700">{taskKpi.disciplineScore}/{taskKpi.disciplineMax}đ</b>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hiển thị lỗi hoặc ghi chú nếu có */}
                                        {myEval && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                                                {(myEval.incidents || []).map(inc => (
                                                    <span key={inc.id} className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-bold text-[10px] flex items-center gap-1">
                                                        <span>⚠️ Vi phạm: {inc.name}</span>
                                                        <b className="text-rose-600">(-{inc.penalty_points}đ)</b>
                                                    </span>
                                                ))}
                                                {myEval.bonus_points ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                                                        🎁 +{myEval.bonus_points}đ Thưởng ({myEval.bonus_reason || 'Đột xuất'})
                                                    </span>
                                                ) : null}
                                                {item.evaluation_note && (
                                                    <span className="text-stone-500 italic text-[11px] ml-1">
                                                        💬 Nhận xét: {item.evaluation_note}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Xuất Phiếu & Ảnh Gửi Zalo */}
            <AnalyticsExportCardModal
                isOpen={showExportZaloModal}
                onClose={() => setShowExportZaloModal(false)}
                systemName={systemName}
                companyName={companyId ? 'Công ty TNHH Chánh Thu' : null}
                dateFrom={dateFrom}
                dateTo={dateTo}
                rows={employeeStats}
                kpis={{
                    total: kpis.total,
                    completed: kpis.completed,
                    partial: kpis.partial,
                    uncompleted: kpis.uncompleted,
                    avgProgress: kpis.avgProgress,
                    totalPositions: kpis.totalPositions,
                    totalDocuments: kpis.totalDocuments,
                    avgStars: kpis.avgStars,
                }}
            />
        </div>
    )
}
