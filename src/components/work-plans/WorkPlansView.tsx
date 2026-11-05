'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
    Calendar,
    ChevronLeft,
    ChevronRight,
    Plus,
    ClipboardPaste,
    Share2,
    CheckCircle2,
    Star,
    Users,
    MapPin,
    Tag,
    Trash2,
    ArrowUp,
    ArrowDown,
    Sparkles,
    BarChart3,
    ClipboardCheck,
    ArrowRightCircle,
    RefreshCw,
    MessageSquare,
    Image as ImageIcon,
    Check,
    X,
    UserPlus,
    Edit3,
    FileImage,
    Award,
    Scale,
    ExternalLink,
    Link2,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import {
    WorkPlan,
    WorkPlanItem,
    WorkPlanAssignee,
    WorkPlanItemStatus,
    WorkPlanPriority,
    WorkPlanRating,
    WorkloadMetrics,
    WORK_CATEGORIES,
    WORK_SHIFTS,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    PRIORITY_CONFIG,
    DIFFICULTY_CONFIG,
    formatVNDate,
    formatVNDateSlash,
    getDayOfWeekVN,
    buildDefaultPlanTitle,
    hasWorkloadData,
} from './types'
import BulkImportModal from './BulkImportModal'
import EvaluateItemModal from './EvaluateItemModal'
import WorkloadMetricsModal from './WorkloadMetricsModal'
import PlanExportCardModal from './PlanExportCardModal'
import WorkPlanAnalyticsTab from './WorkPlanAnalyticsTab'
import ImageLightbox from '@/components/tasks/ImageLightbox'

function getLocalTodayStr(): string {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function addDaysStr(dateStr: string, offset: number): string {
    const d = new Date(`${dateStr}T00:00:00`)
    d.setDate(d.getDate() + offset)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export default function WorkPlansView() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const todayStr = useMemo(() => getLocalTodayStr(), [])
    const tomorrowStr = useMemo(() => addDaysStr(todayStr, 1), [todayStr])
    const yesterdayStr = useMemo(() => addDaysStr(todayStr, -1), [todayStr])

    // Navigation & Mode States
    const [activeMainTab, setActiveMainTab] = useState<'daily' | 'analytics'>('daily')
    const [selectedDate, setSelectedDate] = useState<string>(todayStr)
    const [selectedShift, setSelectedShift] = useState<string>('Cả ngày')
    const [workMode, setWorkMode] = useState<'plan' | 'evaluate'>('plan')

    // Data States
    const [plan, setPlan] = useState<WorkPlan | null>(null)
    const [items, setItems] = useState<WorkPlanItem[]>([])
    const [datesWithPlans, setDatesWithPlans] = useState<Set<string>>(new Set())
    const [availableAssignees, setAvailableAssignees] = useState<
        { id?: string; name: string; type: 'member' | 'team' }[]
    >([])
    const [loading, setLoading] = useState<boolean>(true)

    // Quick Add Form State
    const [newContent, setNewContent] = useState<string>('')
    const [newCategory, setNewCategory] = useState<string>('Vận hành kho')
    const [newPriority, setNewPriority] = useState<WorkPlanPriority>('normal')
    const [newLocation, setNewLocation] = useState<string>('')
    const [newAssignees, setNewAssignees] = useState<WorkPlanAssignee[]>([])
    const [assigneeInput, setAssigneeInput] = useState<string>('')
    const [addingItem, setAddingItem] = useState<boolean>(false)

    // Inline Editing States
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [editingLocation, setEditingLocation] = useState<string>('')
    const [addingAssigneeForItemId, setAddingAssigneeForItemId] = useState<string | null>(null)
    const [inlineAssigneeText, setInlineAssigneeText] = useState<string>('')

    // Plan Header Notes State
    const [editingHeaderNote, setEditingHeaderNote] = useState<boolean>(false)
    const [generalNoteDraft, setGeneralNoteDraft] = useState<string>('')
    const [eodSummaryDraft, setEodSummaryDraft] = useState<string>('')

    // Modals State
    const [showBulkModal, setShowBulkModal] = useState<boolean>(false)
    const [itemToEvaluate, setItemToEvaluate] = useState<WorkPlanItem | null>(null)
    const [itemForWorkloadModal, setItemForWorkloadModal] = useState<WorkPlanItem | null>(null)
    const [showExportModal, setShowExportModal] = useState<boolean>(false)
    const [exportDefaultMode, setExportDefaultMode] = useState<'plan' | 'evaluation'>('plan')

    // Lightbox State
    const [lightboxImages, setLightboxImages] = useState<string[]>([])
    const [lightboxIndex, setLightboxIndex] = useState<number>(0)
    const [showLightbox, setShowLightbox] = useState<boolean>(false)

    const systemCode = currentSystem?.code || 'KHO_DONG_LANH'
    const systemName = currentSystem?.name || 'Kho'
    const companyId = currentSystem?.company_id || profile?.company_id || null

    // 1. Load Members, Teams & Users for Assignee Picker
    useEffect(() => {
        if (!systemCode) return
        const loadAssignees = async () => {
            try {
                const list: { id?: string; name: string; type: 'member' | 'team' }[] = []
                const seen = new Set<string>()

                // Teams
                let tQuery = (supabase as any)
                    .from('construction_teams')
                    .select('id, name')
                    .eq('system_code', systemCode)
                if (companyId) tQuery = tQuery.eq('company_id', companyId)
                const { data: teamData } = await tQuery
                if (Array.isArray(teamData)) {
                    teamData.forEach((t: any) => {
                        const n = (t.name || '').trim()
                        if (n && !seen.has(n.toLowerCase())) {
                            seen.add(n.toLowerCase())
                            list.push({ id: t.id, name: n, type: 'team' })
                        }
                    })
                }

                // Members
                let mQuery = (supabase as any)
                    .from('construction_members')
                    .select('id, full_name, is_active')
                    .eq('system_code', systemCode)
                const { data: memberData } = await mQuery
                if (Array.isArray(memberData)) {
                    memberData.forEach((m: any) => {
                        if (m.is_active === false) return
                        const n = (m.full_name || '').trim()
                        if (n && !seen.has(n.toLowerCase())) {
                            seen.add(n.toLowerCase())
                            list.push({ id: m.id, name: n, type: 'member' })
                        }
                    })
                }

                // Also load user_profiles in company
                if (companyId) {
                    const { data: userData } = await (supabase as any)
                        .from('user_profiles')
                        .select('id, full_name')
                        .eq('company_id', companyId)
                    if (Array.isArray(userData)) {
                        userData.forEach((u: any) => {
                            const n = (u.full_name || '').trim()
                            if (n && !seen.has(n.toLowerCase())) {
                                seen.add(n.toLowerCase())
                                list.push({ id: u.id, name: n, type: 'member' })
                            }
                        })
                    }
                }

                setAvailableAssignees(list)
            } catch (err) {
                console.error('Error loading assignees for work_plan:', err)
            }
        }
        loadAssignees()
    }, [systemCode, companyId])

    // 2. Load Plan & Items for Selected Date
    const loadPlanData = useCallback(async () => {
        if (!systemCode || !selectedDate) return
        setLoading(true)
        try {
            let pQuery = (supabase as any)
                .from('work_plans')
                .select('*')
                .eq('system_code', systemCode)
                .eq('plan_date', selectedDate)
                .eq('shift_name', selectedShift)
                .order('created_at', { ascending: false })
                .limit(1)

            if (companyId) pQuery = pQuery.eq('company_id', companyId)

            const { data: planRows, error: pErr } = await pQuery
            if (pErr) throw pErr

            const currentPlan: WorkPlan | null = planRows?.[0] || null
            setPlan(currentPlan)
            setGeneralNoteDraft(currentPlan?.general_note || '')
            setEodSummaryDraft(currentPlan?.end_of_day_summary || '')

            if (currentPlan) {
                const { data: itemRows, error: iErr } = await (supabase as any)
                    .from('work_plan_items')
                    .select('*')
                    .eq('plan_id', currentPlan.id)
                    .eq('system_code', systemCode)
                    .order('sort_order', { ascending: true })
                    .order('created_at', { ascending: true })
                if (iErr) throw iErr
                setItems(itemRows || [])
            } else {
                setItems([])
            }

            // Load nearby dates that have plans for the 7-day strip indicator
            const rangeStart = addDaysStr(selectedDate, -7)
            const rangeEnd = addDaysStr(selectedDate, 7)
            const { data: nearbyPlans } = await (supabase as any)
                .from('work_plans')
                .select('plan_date')
                .eq('system_code', systemCode)
                .gte('plan_date', rangeStart)
                .lte('plan_date', rangeEnd)

            if (Array.isArray(nearbyPlans)) {
                setDatesWithPlans(new Set(nearbyPlans.map((r: any) => r.plan_date)))
            }
        } catch (err) {
            console.error('Error loading work plan:', err)
        } finally {
            setLoading(false)
        }
    }, [systemCode, companyId, selectedDate, selectedShift])

    useEffect(() => {
        loadPlanData()
    }, [loadPlanData])

    // Realtime Subscription
    useEffect(() => {
        if (!systemCode) return
        const channel = supabase
            .channel(`work_plan_realtime_${systemCode}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'work_plan_items',
                    filter: `system_code=eq.${systemCode}`,
                },
                () => {
                    loadPlanData()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [systemCode, loadPlanData])

    // Ensure a WorkPlan parent record exists for selectedDate + selectedShift before inserting items
    const ensurePlanRecord = async (): Promise<WorkPlan> => {
        if (plan) return plan

        const payload = {
            system_code: systemCode,
            company_id: companyId,
            plan_date: selectedDate,
            shift_name: selectedShift,
            title: `Kế hoạch làm việc kho ngày ${formatVNDate(selectedDate)}`,
            status: 'PLANNED',
            created_by: profile?.id || null,
            created_by_name: profile?.full_name || 'Quản lý kho',
        }

        const { data, error } = await (supabase as any)
            .from('work_plans')
            .insert(payload)
            .select('*')
            .single()

        if (error) throw error
        setPlan(data)
        setDatesWithPlans(prev => new Set([...prev, selectedDate]))
        return data as WorkPlan
    }

    // Add single item
    const handleAddSingleItem = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        const contentTrimmed = newContent.trim()
        if (!contentTrimmed) return

        setAddingItem(true)
        try {
            const activePlan = await ensurePlanRecord()
            const nextOrder =
                items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1

            // Include pending text in assigneeInput if user typed a name without pressing Enter
            let finalAssignees = [...newAssignees]
            if (assigneeInput.trim()) {
                const rawName = assigneeInput.trim()
                const found = availableAssignees.find(
                    a => a.name.toLowerCase() === rawName.toLowerCase()
                )
                if (!finalAssignees.some(a => a.name.toLowerCase() === rawName.toLowerCase())) {
                    finalAssignees.push({
                        id: found?.id,
                        name: found?.name || rawName,
                        type: found?.type || 'custom',
                    })
                }
            }

            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .insert({
                    plan_id: activePlan.id,
                    system_code: systemCode,
                    company_id: companyId,
                    plan_date: selectedDate,
                    sort_order: nextOrder,
                    content: contentTrimmed,
                    category: newCategory,
                    priority: newPriority,
                    location_note: newLocation.trim() || null,
                    assignees: finalAssignees,
                    status: 'pending',
                    progress_percent: 0,
                })
                .select('*')
                .single()

            if (error) throw error
            setItems(prev => [...prev, data])
            setNewContent('')
            setNewLocation('')
            setNewAssignees([])
            setAssigneeInput('')
            showToast(`Đã thêm mục #${nextOrder} vào kế hoạch`, 'success')
        } catch (err) {
            console.error('Add item error:', err)
            showToast('Không thể thêm công việc, vui lòng thử lại', 'error')
        } finally {
            setAddingItem(false)
        }
    }

    // Bulk Import Items
    const handleBulkImport = async (
        imported: {
            content: string
            category: string
            location_note: string
            priority: WorkPlanPriority
            assignees: WorkPlanAssignee[]
        }[]
    ) => {
        try {
            const activePlan = await ensurePlanRecord()
            const startOrder =
                items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1

            const rowsToInsert = imported.map((it, idx) => ({
                plan_id: activePlan.id,
                system_code: systemCode,
                company_id: companyId,
                plan_date: selectedDate,
                sort_order: startOrder + idx,
                content: it.content,
                category: it.category,
                priority: it.priority,
                location_note: it.location_note || null,
                assignees: it.assignees,
                status: 'pending',
                progress_percent: 0,
            }))

            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .insert(rowsToInsert)
                .select('*')

            if (error) throw error
            setItems(prev => [...prev, ...(data || [])])
            showToast(`Đã nhập nhanh ${rowsToInsert.length} công việc thành công!`, 'success')
        } catch (err) {
            console.error('Bulk import error:', err)
            showToast('Lỗi khi nhập danh sách công việc', 'error')
        }
    }

    // Save Evaluation for a single item (from Modal or Quick Click)
    const handleSaveEvaluation = async (
        itemId: string,
        updates: {
            status: WorkPlanItemStatus
            progress_percent: number
            rating: WorkPlanRating | null
            rating_stars: number | null
            evaluation_note: string | null
            completion_images: string[]
            workload_metrics?: WorkloadMetrics
        },
        carryOverTomorrow?: boolean
    ) => {
        try {
            const nowIso = new Date().toISOString()
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({
                    ...updates,
                    evaluated_by: profile?.id || null,
                    evaluated_by_name: profile?.full_name || 'Quản lý',
                    evaluated_at: nowIso,
                    updated_at: nowIso,
                })
                .eq('id', itemId)
                .eq('system_code', systemCode)
                .select('*')
                .single()

            if (error) throw error
            setItems(prev => prev.map(i => (i.id === itemId ? data : i)))

            // Update parent plan status to EVALUATED if needed
            if (plan && plan.status !== 'EVALUATED') {
                await (supabase as any)
                    .from('work_plans')
                    .update({
                        status: 'EVALUATED',
                        evaluated_by: profile?.id || null,
                        evaluated_by_name: profile?.full_name || 'Quản lý',
                        evaluated_at: nowIso,
                    })
                    .eq('id', plan.id)
                    .eq('system_code', systemCode)
            }

            if (carryOverTomorrow) {
                await carryItemsToNextDay([data])
            } else {
                showToast('Đã lưu kết quả đánh giá công việc!', 'success')
            }
        } catch (err) {
            console.error('Save evaluation error:', err)
            showToast('Lỗi khi lưu đánh giá công việc', 'error')
        }
    }

    // Quick 1-click evaluation on row
    const handleQuickEvaluateRow = async (
        item: WorkPlanItem,
        newStatus: WorkPlanItemStatus,
        newRating?: WorkPlanRating
    ) => {
        const progress =
            newStatus === 'completed'
                ? 100
                : newStatus === 'partial'
                ? item.progress_percent > 0 && item.progress_percent < 100
                    ? item.progress_percent
                    : 60
                : 0
        const ratingToUse =
            newRating !== undefined
                ? newRating
                : item.rating ||
                  (newStatus === 'completed'
                      ? 'good'
                      : newStatus === 'partial'
                      ? 'satisfactory'
                      : newStatus === 'uncompleted'
                      ? 'needs_improvement'
                      : null)

        await handleSaveEvaluation(item.id, {
            status: newStatus,
            progress_percent: progress,
            rating: ratingToUse,
            rating_stars: ratingToUse ? RATING_CONFIG[ratingToUse].stars : null,
            evaluation_note: item.evaluation_note,
            completion_images: item.completion_images || [],
        })
    }

    // Evaluate All Pending as Completed (100% + Good)
    const handleCompleteAllItems = async () => {
        const targets = items.filter(
            i => i.status === 'pending' || i.status === 'in_progress'
        )
        if (targets.length === 0) {
            showToast('Tất cả đầu việc trong ngày đã được đánh giá!', 'info')
            return
        }

        const ok = await showConfirm(
            `Xác nhận đánh giá ${targets.length} công việc đang chờ thành "Hoàn thành (100%)" với mức chất lượng "Tốt (4⭐)"? Bạn vẫn có thể sửa từng mục riêng lẻ sau đó.`
        )
        if (!ok) return

        try {
            const nowIso = new Date().toISOString()
            const targetIds = targets.map(t => t.id)
            const { error } = await (supabase as any)
                .from('work_plan_items')
                .update({
                    status: 'completed',
                    progress_percent: 100,
                    rating: 'good',
                    rating_stars: 4,
                    evaluated_by: profile?.id || null,
                    evaluated_by_name: profile?.full_name || 'Quản lý',
                    evaluated_at: nowIso,
                    updated_at: nowIso,
                })
                .in('id', targetIds)
                .eq('system_code', systemCode)

            if (error) throw error
            await loadPlanData()
            showToast(`Đã đánh giá hoàn thành ${targets.length} đầu việc!`, 'success')
        } catch (err) {
            console.error('Complete all error:', err)
            showToast('Không thể cập nhật hàng loạt', 'error')
        }
    }

    // Carry Over Incomplete Items to Next Day
    const carryItemsToNextDay = async (itemsToCarry: WorkPlanItem[]) => {
        const nextDate = addDaysStr(selectedDate, 1)
        try {
            // Find or create next day's plan
            let { data: nextPlans } = await (supabase as any)
                .from('work_plans')
                .select('*')
                .eq('system_code', systemCode)
                .eq('plan_date', nextDate)
                .eq('shift_name', selectedShift)
                .limit(1)

            let targetPlan = nextPlans?.[0]
            if (!targetPlan) {
                const { data: createdPlan, error: cErr } = await (supabase as any)
                    .from('work_plans')
                    .insert({
                        system_code: systemCode,
                        company_id: companyId,
                        plan_date: nextDate,
                        shift_name: selectedShift,
                        title: `Kế hoạch làm việc kho ngày ${formatVNDate(nextDate)}`,
                        status: 'PLANNED',
                        created_by: profile?.id || null,
                        created_by_name: profile?.full_name || 'Quản lý kho',
                    })
                    .select('*')
                    .single()
                if (cErr) throw cErr
                targetPlan = createdPlan
            }

            // Get max sort_order in next day's plan
            const { data: existingNextItems } = await (supabase as any)
                .from('work_plan_items')
                .select('sort_order')
                .eq('plan_id', targetPlan.id)
                .eq('system_code', systemCode)

            const baseOrder =
                Array.isArray(existingNextItems) && existingNextItems.length > 0
                    ? Math.max(...existingNextItems.map((x: any) => x.sort_order || 0)) + 1
                    : 1

            const newNextRows = itemsToCarry.map((src, idx) => ({
                plan_id: targetPlan.id,
                system_code: systemCode,
                company_id: companyId,
                plan_date: nextDate,
                sort_order: baseOrder + idx,
                content: src.content,
                category: src.category,
                priority: src.priority,
                location_note: src.location_note,
                assignees: src.assignees || [],
                status: 'pending',
                progress_percent: 0,
                carried_from_item_id: src.id,
            }))

            const { error: insErr } = await (supabase as any)
                .from('work_plan_items')
                .insert(newNextRows)
            if (insErr) throw insErr

            // Mark source items with carried_to_date = nextDate
            const srcIds = itemsToCarry.map(i => i.id)
            await (supabase as any)
                .from('work_plan_items')
                .update({ carried_to_date: nextDate })
                .in('id', srcIds)
                .eq('system_code', systemCode)

            setItems(prev =>
                prev.map(i =>
                    srcIds.includes(i.id) ? { ...i, carried_to_date: nextDate } : i
                )
            )
            setDatesWithPlans(prev => new Set([...prev, nextDate]))
            showToast(
                `Đã chuyển ${itemsToCarry.length} việc tồn đọng sang ngày ${formatVNDate(nextDate)}!`,
                'success'
            )
        } catch (err) {
            console.error('Carry over error:', err)
            showToast('Lỗi khi chuyển công việc sang ngày hôm sau', 'error')
        }
    }

    const handleCarryAllIncomplete = async () => {
        const incomplete = items.filter(
            i =>
                (i.status === 'uncompleted' ||
                    i.status === 'partial' ||
                    i.status === 'pending') &&
                !i.carried_to_date
        )
        if (incomplete.length === 0) {
            showToast('Không có công việc tồn đọng nào cần chuyển sang ngày mai!', 'info')
            return
        }

        const nextDateFormatted = formatVNDate(addDaysStr(selectedDate, 1))
        const ok = await showConfirm(
            `Bạn có muốn sao chép ${incomplete.length} công việc chưa hoàn thành sang Kế hoạch ngày ${nextDateFormatted} không?`
        )
        if (!ok) return
        await carryItemsToNextDay(incomplete)
    }

    // Inline Edit Save
    const handleSaveInlineEdit = async (item: WorkPlanItem) => {
        if (!editingContent.trim()) return
        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({
                    content: editingContent.trim(),
                    location_note: editingLocation.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
            setEditingItemId(null)
            showToast('Đã cập nhật nội dung công việc', 'success')
        } catch (err) {
            console.error('Update item error:', err)
            showToast('Không thể cập nhật', 'error')
        }
    }

    // Save Workload Metrics Only (from the dedicated Số liệu button modal)
    const handleSaveWorkloadOnly = async (
        itemId: string,
        workloadMetrics: WorkloadMetrics
    ) => {
        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({
                    workload_metrics: workloadMetrics || {},
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === itemId ? data : i)))
            showToast('Đã lưu số liệu chứng minh công việc!', 'success')
        } catch (err) {
            console.error('Save workload metrics error:', err)
            showToast('Không thể lưu số liệu công việc', 'error')
        }
    }

    // Add / Remove Assignee on existing row
    const handleAddAssigneeToRow = async (item: WorkPlanItem, rawName: string) => {
        const trimmed = rawName.trim()
        if (!trimmed) return
        const currentList = Array.isArray(item.assignees) ? item.assignees : []
        if (currentList.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) {
            setInlineAssigneeText('')
            setAddingAssigneeForItemId(null)
            return
        }

        const found = availableAssignees.find(
            a => a.name.toLowerCase() === trimmed.toLowerCase()
        )
        const nextList: WorkPlanAssignee[] = [
            ...currentList,
            {
                id: found?.id,
                name: found?.name || trimmed,
                type: found?.type || 'custom',
            },
        ]

        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({ assignees: nextList })
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
            setInlineAssigneeText('')
            setAddingAssigneeForItemId(null)
        } catch (err) {
            console.error('Update assignee error:', err)
        }
    }

    const handleRemoveAssigneeFromRow = async (
        item: WorkPlanItem,
        nameToRemove: string
    ) => {
        const currentList = Array.isArray(item.assignees) ? item.assignees : []
        const nextList = currentList.filter(a => a.name !== nameToRemove)
        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({ assignees: nextList })
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
        } catch (err) {
            console.error('Remove assignee error:', err)
        }
    }

    // Reorder items (Up / Down)
    const handleMoveItem = async (idx: number, direction: -1 | 1) => {
        const targetIdx = idx + direction
        if (targetIdx < 0 || targetIdx >= items.length) return
        const a = items[idx]
        const b = items[targetIdx]

        const nextItems = [...items]
        nextItems[idx] = { ...b, sort_order: idx + 1 }
        nextItems[targetIdx] = { ...a, sort_order: targetIdx + 1 }
        setItems(nextItems)

        try {
            await Promise.all([
                (supabase as any)
                    .from('work_plan_items')
                    .update({ sort_order: idx + 1 })
                    .eq('id', b.id)
                    .eq('system_code', systemCode),
                (supabase as any)
                    .from('work_plan_items')
                    .update({ sort_order: targetIdx + 1 })
                    .eq('id', a.id)
                    .eq('system_code', systemCode),
            ])
        } catch (err) {
            console.error('Move item error:', err)
            loadPlanData()
        }
    }

    // Delete item & re-number remaining
    const handleDeleteItem = async (item: WorkPlanItem) => {
        const ok = await showConfirm(
            `Bạn có chắc muốn xóa mục "${item.sort_order}. ${item.content}" khỏi kế hoạch ngày ${formatVNDate(selectedDate)}?`
        )
        if (!ok) return

        try {
            const { error } = await (supabase as any)
                .from('work_plan_items')
                .delete()
                .eq('id', item.id)
                .eq('system_code', systemCode)
            if (error) throw error

            const remaining = items
                .filter(i => i.id !== item.id)
                .map((it, index) => ({ ...it, sort_order: index + 1 }))
            setItems(remaining)

            // Re-number in background
            await Promise.all(
                remaining.map(r =>
                    (supabase as any)
                        .from('work_plan_items')
                        .update({ sort_order: r.sort_order })
                        .eq('id', r.id)
                        .eq('system_code', systemCode)
                )
            )
            showToast('Đã xóa đầu việc và cập nhật lại số thứ tự', 'success')
        } catch (err) {
            console.error('Delete item error:', err)
            showToast('Lỗi khi xóa đầu việc', 'error')
        }
    }

    // Save Plan Header Notes (General Note & End of Day Summary)
    const handleSavePlanNotes = async () => {
        try {
            const activePlan = await ensurePlanRecord()
            const { data, error } = await (supabase as any)
                .from('work_plans')
                .update({
                    general_note: generalNoteDraft.trim() || null,
                    end_of_day_summary: eodSummaryDraft.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', activePlan.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()

            if (error) throw error
            setPlan(data)
            setEditingHeaderNote(false)
            showToast('Đã lưu ghi chú kế hoạch & nhận xét tổng kết ngày!', 'success')
        } catch (err) {
            console.error('Save plan notes error:', err)
            showToast('Không thể lưu ghi chú', 'error')
        }
    }

    // Daily KPI Summary Calculations
    const dailyStats = useMemo(() => {
        const active = items.filter(i => i.status !== 'cancelled')
        const completed = active.filter(i => i.status === 'completed').length
        const partial = active.filter(i => i.status === 'partial').length
        const uncompleted = active.filter(i => i.status === 'uncompleted').length
        const pending = active.filter(
            i => i.status === 'pending' || i.status === 'in_progress'
        ).length
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

        const assigneeSet = new Set<string>()
        active.forEach(i => {
            if (Array.isArray(i.assignees)) {
                i.assignees.forEach(a => {
                    if (a?.name) assigneeSet.add(a.name.trim())
                })
            }
        })

        return {
            total: active.length,
            completed,
            partial,
            uncompleted,
            pending,
            avgProgress,
            avgStars,
            uniqueAssignees: assigneeSet.size,
        }
    }, [items])

    // 7-day strip around selectedDate
    const sevenDaysStrip = useMemo(() => {
        return [-3, -2, -1, 0, 1, 2, 3].map(offset => {
            const dStr = addDaysStr(selectedDate, offset)
            const parts = dStr.split('-')
            return {
                dateStr: dStr,
                dayNum: `${parts[2]}/${parts[1]}`,
                dow: getDayOfWeekVN(dStr).replace('Thứ ', 'T').replace('Chủ Nhật', 'CN'),
                isToday: dStr === todayStr,
                isTomorrow: dStr === tomorrowStr,
                hasPlan: datesWithPlans.has(dStr),
            }
        })
    }, [selectedDate, todayStr, tomorrowStr, datesWithPlans])

    return (
        <div className="p-3 sm:p-5 md:p-6 max-w-7xl mx-auto space-y-5">
            {/* Top Page Header & Main Tab Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shrink-0">
                        <ClipboardCheck size={26} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-extrabold text-stone-900">
                                Kế Hoạch Công Việc & Đánh Giá Cuối Ngày
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {systemName}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                            Lập danh sách đầu việc hàng ngày, phân công nhân sự, đánh giá chất lượng cuối ngày & xuất phiếu Zalo/Excel
                        </p>
                    </div>
                </div>

                {/* Main Tabs: Daily Plan vs Analytics */}
                <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 self-start lg:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveMainTab('daily')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeMainTab === 'daily'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-stone-600 hover:text-stone-900'
                        }`}
                    >
                        <Calendar size={15} />
                        Kế Hoạch & Đánh Giá Ngày
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveMainTab('analytics')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeMainTab === 'analytics'
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-stone-600 hover:text-stone-900'
                        }`}
                    >
                        <BarChart3 size={15} />
                        Thống Kê Hiệu Suất Nhân Viên
                    </button>
                </div>
            </div>

            {activeMainTab === 'analytics' ? (
                <WorkPlanAnalyticsTab
                    systemCode={systemCode}
                    systemName={systemName}
                    companyId={companyId}
                />
            ) : (
                <>
                    {/* Date Navigator & Shift Strip */}
                    <div className="bg-white rounded-2xl border border-stone-200 p-3.5 sm:p-4 shadow-xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            {/* Quick Date Shortcuts */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedDate(addDaysStr(selectedDate, -1))
                                    }
                                    className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600"
                                    title="Ngày trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(yesterdayStr)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                        selectedDate === yesterdayStr
                                            ? 'bg-stone-800 text-white border-stone-800'
                                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                    }`}
                                >
                                    Hôm qua
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(todayStr)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                        selectedDate === todayStr
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                                    }`}
                                >
                                    Hôm nay ({formatVNDate(todayStr).slice(0, 5)})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(tomorrowStr)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${
                                        selectedDate === tomorrowStr
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                            : 'bg-indigo-50/70 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                    }`}
                                >
                                    <Sparkles size={13} />
                                    Kế hoạch Ngày mai ({formatVNDate(tomorrowStr).slice(0, 5)})
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setSelectedDate(addDaysStr(selectedDate, 1))
                                    }
                                    className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600"
                                    title="Ngày kế tiếp"
                                >
                                    <ChevronRight size={16} />
                                </button>

                                {/* Date Input Picker */}
                                <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-800">
                                    <Calendar size={14} className="text-indigo-600" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={e =>
                                            e.target.value && setSelectedDate(e.target.value)
                                        }
                                        className="bg-transparent outline-hidden cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Shift Selector & Mode Switcher */}
                            <div className="flex flex-wrap items-center gap-2">
                                <select
                                    value={selectedShift}
                                    onChange={e => setSelectedShift(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-xs font-bold text-stone-700 outline-hidden"
                                >
                                    {WORK_SHIFTS.map(s => (
                                        <option key={s} value={s}>
                                            Ca: {s}
                                        </option>
                                    ))}
                                </select>

                                {/* Mode Toggle: Lập Kế Hoạch vs Đánh Giá Cuối Ngày */}
                                <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
                                    <button
                                        type="button"
                                        onClick={() => setWorkMode('plan')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            workMode === 'plan'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                    >
                                        📝 1. Lập Kế Hoạch & Giao Việc
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWorkMode('evaluate')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            workMode === 'evaluate'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                    >
                                        ⭐ 2. Đánh Giá Cuối Ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 7-Day Mini Calendar Strip */}
                        <div className="grid grid-cols-7 gap-1.5 pt-1">
                            {sevenDaysStrip.map(d => {
                                const active = d.dateStr === selectedDate
                                return (
                                    <button
                                        key={d.dateStr}
                                        type="button"
                                        onClick={() => setSelectedDate(d.dateStr)}
                                        className={`py-1.5 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center relative ${
                                            active
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                                                : 'bg-stone-50/60 border-stone-200 text-stone-600 hover:bg-stone-100'
                                        }`}
                                    >
                                        <span className="text-[10px] font-bold uppercase opacity-75">
                                            {d.dow}
                                        </span>
                                        <span className="text-xs font-black">{d.dayNum}</span>
                                        {d.hasPlan && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Daily KPI Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                            <div className="text-xs font-bold text-stone-500 uppercase">
                                Đầu Việc Ngày {formatVNDate(selectedDate).slice(0, 5)}
                            </div>
                            <div className="flex items-baseline justify-between mt-1.5">
                                <span className="text-2xl font-black text-stone-900">
                                    {dailyStats.total}
                                </span>
                                <span className="text-xs font-semibold text-indigo-600">
                                    {getDayOfWeekVN(selectedDate)}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                            <div className="text-xs font-bold text-stone-500 uppercase">
                                Tiến Độ Hoàn Thành
                            </div>
                            <div className="flex items-baseline justify-between mt-1.5">
                                <span className="text-2xl font-black text-emerald-600">
                                    {dailyStats.avgProgress}%
                                </span>
                                <span className="text-xs text-stone-500 font-medium">
                                    Xong: <b>{dailyStats.completed}</b>/{dailyStats.total}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${dailyStats.avgProgress}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                            <div className="text-xs font-bold text-stone-500 uppercase">
                                Đánh Giá Chất Lượng
                            </div>
                            <div className="flex items-baseline justify-between mt-1.5">
                                <span className="text-2xl font-black text-amber-500">
                                    {dailyStats.avgStars
                                        ? `${dailyStats.avgStars} ⭐`
                                        : 'Chưa chấm'}
                                </span>
                                <span className="text-xs text-stone-500">Thang 5 sao</span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs">
                            <div className="text-xs font-bold text-stone-500 uppercase">
                                Nhân Sự Phân Công
                            </div>
                            <div className="flex items-baseline justify-between mt-1.5">
                                <span className="text-2xl font-black text-indigo-700">
                                    {dailyStats.uniqueAssignees || 'Toàn đội'}
                                </span>
                                <span className="text-xs text-stone-500">
                                    {dailyStats.uncompleted > 0
                                        ? `${dailyStats.uncompleted} việc chưa xong`
                                        : 'Đang theo dõi'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Main Plan Sheet Card */}
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                        {/* Sheet Title & Action Buttons Header */}
                        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-xs font-black tracking-wider uppercase">
                                    HD
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-xl font-black tracking-tight">
                                        Kế hoạch làm việc kho ngày {formatVNDate(selectedDate)}
                                    </h2>
                                    <p className="text-xs text-stone-300">
                                        {getDayOfWeekVN(selectedDate)} • Ca: {selectedShift} • Phân hệ:{' '}
                                        {systemName}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowBulkModal(true)}
                                    className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                                >
                                    <ClipboardPaste size={15} />
                                    Nhập nhanh nhiều dòng (Zalo/Excel)
                                </button>

                                {items.length > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleCompleteAllItems}
                                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                                            title="Đánh giá nhanh hoàn thành 100% cho tất cả việc đang chờ"
                                        >
                                            <CheckCircle2 size={15} />
                                            Chấm Hoàn Thành Tất Cả
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleCarryAllIncomplete}
                                            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                                            title="Chuyển các công việc chưa xong sang ngày kế tiếp"
                                        >
                                            <ArrowRightCircle size={15} />
                                            Chuyển việc tồn sang ngày mai
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExportDefaultMode(
                                                    workMode === 'evaluate'
                                                        ? 'evaluation'
                                                        : 'plan'
                                                )
                                                setShowExportModal(true)
                                            }}
                                            className="px-3.5 py-2 rounded-xl bg-white text-stone-900 hover:bg-stone-100 text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition-all"
                                        >
                                            <FileImage size={15} className="text-indigo-600" />
                                            Xuất Ảnh Phiếu / Gửi Zalo
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Quick Add Single Work Item Bar */}
                        <form
                            onSubmit={handleAddSingleItem}
                            className="p-4 bg-stone-50 border-b border-stone-200 space-y-3"
                        >
                            <div className="flex flex-col md:flex-row gap-2.5">
                                <div className="flex items-center gap-2 flex-1">
                                    <span className="w-8 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                        #{items.length + 1}
                                    </span>
                                    <input
                                        type="text"
                                        value={newContent}
                                        onChange={e => setNewContent(e.target.value)}
                                        placeholder="Nhập nội dung công việc mới (VD: Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont)..."
                                        className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={newCategory}
                                        onChange={e => setNewCategory(e.target.value)}
                                        className="rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-stone-700 outline-hidden"
                                    >
                                        {WORK_CATEGORIES.map(c => (
                                            <option key={c} value={c}>
                                                {c}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={newPriority}
                                        onChange={e =>
                                            setNewPriority(e.target.value as WorkPlanPriority)
                                        }
                                        className="rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-stone-700 outline-hidden"
                                    >
                                        <option value="normal">Ưu tiên: Thường</option>
                                        <option value="important">Ưu tiên: Quan trọng</option>
                                        <option value="urgent">Ưu tiên: Khẩn cấp</option>
                                    </select>

                                    <input
                                        type="text"
                                        value={newLocation}
                                        onChange={e => setNewLocation(e.target.value)}
                                        placeholder="Khu vực (VD: Kho 1)"
                                        className="w-36 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 outline-hidden focus:border-indigo-500"
                                    />

                                    <button
                                        type="submit"
                                        disabled={!newContent.trim() || addingItem}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                                    >
                                        <Plus size={16} />
                                        Thêm việc
                                    </button>
                                </div>
                            </div>

                            {/* Quick Assignee Selector for New Item */}
                            <div className="flex flex-wrap items-center gap-2 pl-10">
                                <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                                    <Users size={13} className="text-indigo-600" />
                                    Giao cho:
                                </span>

                                {newAssignees.map(a => (
                                    <span
                                        key={a.name}
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                    >
                                        {a.name}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setNewAssignees(prev =>
                                                    prev.filter(x => x.name !== a.name)
                                                )
                                            }
                                            className="hover:text-rose-600"
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}

                                <input
                                    type="text"
                                    list="work-plan-assignees-datalist"
                                    value={assigneeInput}
                                    onChange={e => setAssigneeInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            const val = assigneeInput.trim()
                                            if (!val) return
                                            const found = availableAssignees.find(
                                                a => a.name.toLowerCase() === val.toLowerCase()
                                            )
                                            if (
                                                !newAssignees.some(
                                                    a =>
                                                        a.name.toLowerCase() ===
                                                        val.toLowerCase()
                                                )
                                            ) {
                                                setNewAssignees(prev => [
                                                    ...prev,
                                                    {
                                                        id: found?.id,
                                                        name: found?.name || val,
                                                        type: found?.type || 'custom',
                                                    },
                                                ])
                                            }
                                            setAssigneeInput('')
                                        }
                                    }}
                                    placeholder="+ Chọn hoặc gõ tên nhân viên / đội (Enter)..."
                                    className="px-2.5 py-1 rounded-lg border border-dashed border-stone-300 bg-white text-xs text-stone-700 w-64 outline-hidden focus:border-indigo-500"
                                />
                                <datalist id="work-plan-assignees-datalist">
                                    {availableAssignees.map((a, i) => (
                                        <option key={i} value={a.name}>
                                            {a.type === 'team' ? 'Tổ / Đội' : 'Nhân viên'}
                                        </option>
                                    ))}
                                </datalist>
                            </div>
                        </form>

                        {/* Work Items List (Spreadsheet-inspired Interactive Table) */}
                        {loading ? (
                            <div className="p-12 text-center text-sm text-stone-500">
                                Đang tải bảng kế hoạch ngày {formatVNDate(selectedDate)}...
                            </div>
                        ) : items.length === 0 ? (
                            <div className="p-10 sm:p-14 text-center space-y-4">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                                    <ClipboardCheck size={32} />
                                </div>
                                <div className="max-w-md mx-auto space-y-1">
                                    <h3 className="text-base font-bold text-stone-800">
                                        Chưa có công việc nào trong ngày {formatVNDate(selectedDate)}
                                    </h3>
                                    <p className="text-xs text-stone-500 leading-relaxed">
                                        Bạn có thể thêm từng việc ở thanh phía trên, hoặc bấm nút{' '}
                                        <b>&ldquo;Nhập nhanh nhiều dòng (Zalo/Excel)&rdquo;</b> để dán
                                        toàn bộ kế hoạch 1, 2, 3... chỉ trong vài giây.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setShowBulkModal(true)}
                                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                                    >
                                        <ClipboardPaste size={15} />
                                        Nhập nhanh danh sách 1, 2, 3...
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="divide-y divide-stone-200">
                                {items.map((item, idx) => {
                                    const st = ITEM_STATUS_CONFIG[item.status]
                                    const rt = item.rating ? RATING_CONFIG[item.rating] : null
                                    const pri = PRIORITY_CONFIG[item.priority]
                                    const isEditing = editingItemId === item.id

                                    return (
                                        <div
                                            key={item.id}
                                            className={`p-3.5 sm:px-5 sm:py-4 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                                                item.status === 'completed'
                                                    ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                                    : item.status === 'uncompleted'
                                                    ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                                    : 'hover:bg-stone-50/80'
                                            }`}
                                        >
                                            {/* Left: STT + Content + Metadata + Assignees */}
                                            <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                                {/* STT Badge + Reorder Arrows */}
                                                <div className="flex flex-col items-center gap-1 shrink-0">
                                                    <div
                                                        className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center border ${
                                                            item.status === 'completed'
                                                                ? 'bg-emerald-600 text-white border-emerald-600'
                                                                : 'bg-stone-900 text-white border-stone-900'
                                                        }`}
                                                    >
                                                        {idx + 1}.
                                                    </div>
                                                    <div className="flex items-center gap-0.5">
                                                        <button
                                                            type="button"
                                                            disabled={idx === 0}
                                                            onClick={() => handleMoveItem(idx, -1)}
                                                            className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-25"
                                                            title="Chuyển lên"
                                                        >
                                                            <ArrowUp size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={idx === items.length - 1}
                                                            onClick={() => handleMoveItem(idx, 1)}
                                                            className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-25"
                                                            title="Chuyển xuống"
                                                        >
                                                            <ArrowDown size={12} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Content & Tags */}
                                                <div className="flex-1 min-w-0 space-y-2">
                                                    {isEditing ? (
                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingContent}
                                                                onChange={e =>
                                                                    setEditingContent(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-400 text-sm font-semibold text-stone-900 outline-hidden"
                                                                autoFocus
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editingLocation}
                                                                onChange={e =>
                                                                    setEditingLocation(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Khu vực..."
                                                                className="w-36 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-700 outline-hidden"
                                                            />
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleSaveInlineEdit(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                                                                >
                                                                    Lưu
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditingItemId(null)
                                                                    }
                                                                    className="px-2.5 py-1.5 rounded-lg bg-stone-200 text-stone-700 text-xs font-bold"
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p
                                                                onDoubleClick={() => {
                                                                    setEditingItemId(item.id)
                                                                    setEditingContent(item.content)
                                                                    setEditingLocation(
                                                                        item.location_note || ''
                                                                    )
                                                                }}
                                                                className={`text-sm sm:text-base font-bold leading-snug cursor-pointer ${
                                                                    item.status === 'cancelled'
                                                                        ? 'line-through text-stone-400'
                                                                        : 'text-stone-900'
                                                                }`}
                                                                title="Nhấp đúp để sửa nhanh nội dung"
                                                            >
                                                                {item.content}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Badges Row: Category, Priority, Location, Assignees */}
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {item.category && (
                                                            <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 text-[11px] font-semibold">
                                                                {item.category}
                                                            </span>
                                                        )}

                                                        {item.priority !== 'normal' && (
                                                            <span
                                                                className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${pri.bgClass} ${pri.textClass} ${pri.borderClass}`}
                                                            >
                                                                {pri.label}
                                                            </span>
                                                        )}

                                                        {item.location_note && (
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-50/80 text-amber-800 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
                                                                <MapPin size={11} />
                                                                {item.location_note}
                                                            </span>
                                                        )}

                                                        {/* Assignee Chips */}
                                                        {Array.isArray(item.assignees) &&
                                                            item.assignees.map(a => (
                                                                <span
                                                                    key={a.name}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold"
                                                                >
                                                                    👤 {a.name}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleRemoveAssigneeFromRow(
                                                                                item,
                                                                                a.name
                                                                            )
                                                                        }
                                                                        className="hover:text-rose-600 ml-0.5"
                                                                        title="Gỡ người này"
                                                                    >
                                                                        <X size={11} />
                                                                    </button>
                                                                </span>
                                                            ))}

                                                        {/* Inline Add Assignee Button/Input */}
                                                        {addingAssigneeForItemId === item.id ? (
                                                            <div className="inline-flex items-center gap-1">
                                                                <input
                                                                    type="text"
                                                                    list="work-plan-assignees-datalist"
                                                                    value={inlineAssigneeText}
                                                                    onChange={e =>
                                                                        setInlineAssigneeText(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    onKeyDown={e => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault()
                                                                            handleAddAssigneeToRow(
                                                                                item,
                                                                                inlineAssigneeText
                                                                            )
                                                                        } else if (
                                                                            e.key === 'Escape'
                                                                        ) {
                                                                            setAddingAssigneeForItemId(
                                                                                null
                                                                            )
                                                                        }
                                                                    }}
                                                                    placeholder="Tên NV/Đội (Enter)"
                                                                    className="px-2 py-0.5 rounded-lg border border-indigo-400 text-xs w-36 outline-hidden"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleAddAssigneeToRow(
                                                                            item,
                                                                            inlineAssigneeText
                                                                        )
                                                                    }
                                                                    className="p-1 rounded-md bg-indigo-600 text-white"
                                                                >
                                                                    <Check size={11} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setAddingAssigneeForItemId(
                                                                        item.id
                                                                    )
                                                                    setInlineAssigneeText('')
                                                                }}
                                                                className="px-2 py-0.5 rounded-full border border-dashed border-stone-300 hover:border-indigo-400 text-[11px] font-semibold text-stone-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                                            >
                                                                <UserPlus size={11} />
                                                                Giao người
                                                            </button>
                                                        )}

                                                        {item.carried_to_date && (
                                                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                                                                ↪ Đã chuyển sang{' '}
                                                                {formatVNDate(item.carried_to_date)}
                                                            </span>
                                                        )}

                                                        {/* Single Consolidated Workload / Proof Button */}
                                                        {(() => {
                                                            const wl = item.workload_metrics
                                                            const hasData = hasWorkloadData(wl)
                                                            if (!hasData || !wl) {
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setItemForWorkloadModal(
                                                                                item
                                                                            )
                                                                        }
                                                                        className="px-2.5 py-0.5 rounded-full border border-dashed border-amber-400 bg-amber-50/50 hover:bg-amber-100 text-[11px] font-bold text-amber-800 flex items-center gap-1 transition-colors"
                                                                        title="Bấm để gắn Lệnh xuất kho, Phiếu nhập/xuất kế toán, Số LOT tạo hoặc nhập số liệu độ nặng/nhẹ"
                                                                    >
                                                                        <Scale size={11} />
                                                                        <span>+ Số liệu</span>
                                                                    </button>
                                                                )
                                                            }

                                                            const diffCfg =
                                                                wl.difficulty &&
                                                                DIFFICULTY_CONFIG[wl.difficulty]
                                                                    ? DIFFICULTY_CONFIG[
                                                                          wl.difficulty
                                                                      ]
                                                                    : null

                                                            const linkedCount =
                                                                (wl.linked_export_orders?.length ||
                                                                    0) +
                                                                (wl.linked_inbound_orders?.length ||
                                                                    0) +
                                                                (wl.linked_outbound_orders
                                                                    ?.length || 0) +
                                                                (wl.linked_lot_summaries?.length ||
                                                                    0)

                                                            const factorSuffix = wl.quantity_factor_label
                                                                ? ` (${wl.quantity_factor_label})`
                                                                : ''

                                                            const summaryParts: string[] = []
                                                            if (diffCfg) {
                                                                summaryParts.push(
                                                                    `${diffCfg.badgeEmoji} ${diffCfg.label}`
                                                                )
                                                            }
                                                            if (wl.positions_count) {
                                                                summaryParts.push(
                                                                    `${wl.positions_count} vị trí${factorSuffix}`
                                                                )
                                                            } else if (wl.lots_count) {
                                                                summaryParts.push(
                                                                    `${wl.lots_count} LOT${factorSuffix}`
                                                                )
                                                            } else if (wl.packages_count) {
                                                                summaryParts.push(
                                                                    `${wl.packages_count.toLocaleString('vi-VN')} ${wl.package_unit || 'Thùng'}${factorSuffix}`
                                                                )
                                                            } else if (wl.quantity_factor_label) {
                                                                summaryParts.push(
                                                                    wl.quantity_factor_label
                                                                )
                                                            }
                                                            if (linkedCount > 0) {
                                                                summaryParts.push(
                                                                    `${linkedCount} chứng từ`
                                                                )
                                                            }

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setItemForWorkloadModal(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="px-2.5 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[11px] font-bold text-indigo-800 flex items-center gap-1.5 shadow-2xs transition-colors"
                                                                    title={
                                                                        wl.quantity_adjustment_note
                                                                            ? `Lý do hệ số: ${wl.quantity_adjustment_note} (Bấm để chỉnh sửa)`
                                                                            : 'Bấm để xem liên kết chứng từ hoặc chỉnh sửa thêm/bớt số liệu'
                                                                    }
                                                                >
                                                                    <Scale size={11} />
                                                                    <span>
                                                                        Số liệu
                                                                        {summaryParts.length > 0
                                                                            ? `: ${summaryParts.join(' • ')}`
                                                                            : ''}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })()}
                                                    </div>

                                                    {/* Evaluation Note, Workload Adjustment Note & Proof Images */}
                                                    {(item.evaluation_note ||
                                                        item.workload_metrics
                                                            ?.quantity_adjustment_note ||
                                                        (Array.isArray(item.completion_images) &&
                                                            item.completion_images.length >
                                                                0)) && (
                                                        <div className="mt-2 p-2.5 rounded-xl bg-white border border-stone-200/90 space-y-2">
                                                            {item.workload_metrics
                                                                ?.quantity_adjustment_note && (
                                                                <div className="text-xs text-indigo-900 flex items-start gap-1.5">
                                                                    <Scale
                                                                        size={13}
                                                                        className="text-indigo-600 shrink-0 mt-0.5"
                                                                    />
                                                                    <span>
                                                                        <b className="text-indigo-950">
                                                                            Ghi chú hệ số khối lượng
                                                                            {item.workload_metrics
                                                                                .quantity_factor_label
                                                                                ? ` (${item.workload_metrics.quantity_factor_label})`
                                                                                : ''}
                                                                            :{' '}
                                                                        </b>
                                                                        {
                                                                            item.workload_metrics
                                                                                .quantity_adjustment_note
                                                                        }
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {item.evaluation_note && (
                                                                <div className="text-xs text-stone-700 flex items-start gap-1.5">
                                                                    <MessageSquare
                                                                        size={13}
                                                                        className="text-emerald-600 shrink-0 mt-0.5"
                                                                    />
                                                                    <span>
                                                                        <b className="text-stone-900">
                                                                            Đánh giá cuối ngày:{' '}
                                                                        </b>
                                                                        {item.evaluation_note}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {Array.isArray(
                                                                item.completion_images
                                                            ) &&
                                                                item.completion_images.length >
                                                                    0 && (
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        {item.completion_images.map(
                                                                            (imgUrl, imgIdx) => (
                                                                                <button
                                                                                    key={imgIdx}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setLightboxImages(
                                                                                            item.completion_images
                                                                                        )
                                                                                        setLightboxIndex(
                                                                                            imgIdx
                                                                                        )
                                                                                        setShowLightbox(
                                                                                            true
                                                                                        )
                                                                                    }}
                                                                                    className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 hover:ring-2 hover:ring-emerald-500 transition-all"
                                                                                >
                                                                                    <img
                                                                                        src={
                                                                                            imgUrl
                                                                                        }
                                                                                        alt="Minh chứng"
                                                                                        className="w-full h-full object-cover"
                                                                                    />
                                                                                </button>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Evaluation Controls & Actions */}
                                            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pl-11 lg:pl-0 shrink-0">
                                                {/* Quick 1-click Status Pills */}
                                                <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleQuickEvaluateRow(
                                                                item,
                                                                'completed'
                                                            )
                                                        }
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                                            item.status === 'completed'
                                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                                : 'text-stone-600 hover:bg-white'
                                                        }`}
                                                        title="Đánh dấu Hoàn thành 100%"
                                                    >
                                                        ✓ Xong
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleQuickEvaluateRow(item, 'partial')
                                                        }
                                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                                            item.status === 'partial'
                                                                ? 'bg-amber-500 text-white shadow-xs'
                                                                : 'text-stone-600 hover:bg-white'
                                                        }`}
                                                        title="Đạt một phần"
                                                    >
                                                        Một phần
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleQuickEvaluateRow(
                                                                item,
                                                                'uncompleted'
                                                            )
                                                        }
                                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                                                            item.status === 'uncompleted'
                                                                ? 'bg-rose-600 text-white shadow-xs'
                                                                : 'text-stone-600 hover:bg-white'
                                                        }`}
                                                        title="Chưa xong / Tồn đọng"
                                                    >
                                                        Chưa xong
                                                    </button>
                                                </div>

                                                {/* Star Rating Badge or Quick Star Picker */}
                                                {rt ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setItemToEvaluate(item)}
                                                        className={`px-2.5 py-1 rounded-xl border text-xs font-bold flex items-center gap-1 ${rt.bgClass} ${rt.textClass} ${rt.borderClass}`}
                                                        title="Bấm để sửa đánh giá chi tiết"
                                                    >
                                                        <span>{'★'.repeat(rt.stars)}</span>
                                                        <span>{rt.label}</span>
                                                    </button>
                                                ) : null}

                                                {/* Detailed Evaluate Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => setItemToEvaluate(item)}
                                                    className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors"
                                                >
                                                    <Award size={14} />
                                                    Đánh giá
                                                </button>

                                                {/* Edit & Delete Buttons */}
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingItemId(item.id)
                                                            setEditingContent(item.content)
                                                            setEditingLocation(
                                                                item.location_note || ''
                                                            )
                                                        }}
                                                        className="p-1.5 rounded-lg text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                        title="Sửa nội dung"
                                                    >
                                                        <Edit3 size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteItem(item)}
                                                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Xóa đầu việc"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Plan Footer: General Note & End-of-Day Manager Summary */}
                        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200">
                            {editingHeaderNote ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-stone-600 block mb-1">
                                                📌 Ghi chú điều phối đầu ngày (Hiển thị trên phiếu Kế hoạch)
                                            </label>
                                            <textarea
                                                value={generalNoteDraft}
                                                onChange={e =>
                                                    setGeneralNoteDraft(e.target.value)
                                                }
                                                rows={2}
                                                placeholder="VD: Anh em lưu ý kiểm tra kỹ càng xe nâng trước khi vào kho lạnh..."
                                                className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs text-stone-800 outline-hidden focus:border-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-600 block mb-1">
                                                📝 Nhận xét tổng kết cuối ngày của Quản lý
                                            </label>
                                            <textarea
                                                value={eodSummaryDraft}
                                                onChange={e => setEodSummaryDraft(e.target.value)}
                                                rows={2}
                                                placeholder="VD: Hoàn thành tốt tiến độ xuất cont, kho bao bì mới đã dọn sạch 100%..."
                                                className="w-full rounded-xl border border-stone-300 bg-white p-2.5 text-xs text-stone-800 outline-hidden focus:border-emerald-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEditingHeaderNote(false)}
                                            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-bold text-stone-600"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSavePlanNotes}
                                            className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold"
                                        >
                                            Lưu ghi chú & tổng kết
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1 text-xs text-stone-600">
                                        <div>
                                            <b className="text-stone-800">
                                                📌 Ghi chú điều phối:{' '}
                                            </b>
                                            {plan?.general_note || (
                                                <span className="italic text-stone-400">
                                                    Chưa có ghi chú đầu ngày
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <b className="text-stone-800">
                                                📝 Tổng kết cuối ngày:{' '}
                                            </b>
                                            {plan?.end_of_day_summary || (
                                                <span className="italic text-stone-400">
                                                    Chưa có nhận xét tổng kết cuối ngày
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEditingHeaderNote(true)}
                                        className="px-3 py-1.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-xs font-bold text-stone-700 self-start sm:self-center shrink-0"
                                    >
                                        ✎ Sửa ghi chú & Tổng kết ngày
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Modals */}
            <BulkImportModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                planDateFormatted={formatVNDate(selectedDate)}
                availableAssignees={availableAssignees}
                onConfirmImport={handleBulkImport}
            />

            <EvaluateItemModal
                item={itemToEvaluate}
                isOpen={!!itemToEvaluate}
                onClose={() => setItemToEvaluate(null)}
                onSaveEvaluation={handleSaveEvaluation}
            />

            <WorkloadMetricsModal
                item={itemForWorkloadModal}
                isOpen={!!itemForWorkloadModal}
                onClose={() => setItemForWorkloadModal(null)}
                onSaveWorkload={handleSaveWorkloadOnly}
            />

            <PlanExportCardModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                plan={plan}
                items={items}
                planDate={selectedDate}
                systemName={systemName}
                companyName={profile?.company_name}
                defaultMode={exportDefaultMode}
            />

            {showLightbox && (
                <ImageLightbox
                    images={lightboxImages}
                    currentIndex={lightboxIndex}
                    onNavigate={setLightboxIndex}
                    onClose={() => setShowLightbox(false)}
                />
            )}
        </div>
    )
}
