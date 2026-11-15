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
    BookmarkPlus,
    ArrowRight,
    BookOpen,
    FileText,
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
    WorkPlanTaskType,
    TASK_TYPE_CONFIG,
    WorkPlanWorkNature,
    WORK_NATURE_CONFIG,
    getWarehouseBadge,
    formatVNDate,
    formatVNDateSlash,
    getDayOfWeekVN,
    buildDefaultPlanTitle,
    hasWorkloadData,
    getStatisticsDocumentCounts,
    getEvaluationHours,
} from './types'
import BulkImportModal from './BulkImportModal'
import EvaluateItemModal from './EvaluateItemModal'
import WorkloadMetricsModal from './WorkloadMetricsModal'
import PlanExportCardModal from './PlanExportCardModal'
import WorkPlanAnalyticsTab from './WorkPlanAnalyticsTab'
import TaskLibraryTab, { WorkTaskTemplate } from './TaskLibraryTab'
import TaskLibraryPickerModal from './TaskLibraryPickerModal'
import KpiRulesHandbookTab from './KpiRulesHandbookTab'
import ImageLightbox from '@/components/tasks/ImageLightbox'
import { QuickAssignForm } from './view/QuickAssignForm'
import { WorkItemsList } from './view/WorkItemsList'

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

// 5 Top-level Tabs: Thư Viện -> Giao Việc -> Đánh Giá -> Báo Cáo -> Quy Chế
export type WorkPlanTopTab = 'library' | 'dispatch' | 'evaluate' | 'reports' | 'rules'

export default function WorkPlansView() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast, showConfirm } = useToast()

    const todayStr = useMemo(() => getLocalTodayStr(), [])
    const tomorrowStr = useMemo(() => addDaysStr(todayStr, 1), [todayStr])
    const yesterdayStr = useMemo(() => addDaysStr(todayStr, -1), [todayStr])

    const [activeTab, setActiveTab] = useState<WorkPlanTopTab>('dispatch')
    const [selectedDate, setSelectedDate] = useState<string>(todayStr)
    const [selectedShift, setSelectedShift] = useState<string>('Cả ngày')

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
    const [newTaskType, setNewTaskType] = useState<WorkPlanTaskType>('primary')
    const [newWorkNature, setNewWorkNature] = useState<WorkPlanWorkNature>('labor')
    const [newLocation, setNewLocation] = useState<string>('')
    const [newAssignees, setNewAssignees] = useState<WorkPlanAssignee[]>([])
    const [assigneeInput, setAssigneeInput] = useState<string>('')
    const [addingItem, setAddingItem] = useState<boolean>(false)

    // Library Picker Modal State
    const [showLibraryPicker, setShowLibraryPicker] = useState<boolean>(false)

    // Inline Editing States
    const [editingItemId, setEditingItemId] = useState<string | null>(null)
    const [editingContent, setEditingContent] = useState<string>('')
    const [editingDescription, setEditingDescription] = useState<string>('')
    const [editingLocation, setEditingLocation] = useState<string>('')
    const [addingAssigneeForItemId, setAddingAssigneeForItemId] = useState<string | null>(null)
    const [inlineAssigneeText, setInlineAssigneeText] = useState<string>('')

    // Templates Descriptions Map (để hiển thị mô tả công việc từ mẫu)
    const [templatesMap, setTemplatesMap] = useState<Map<string, string>>(new Map())

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

    // Load template descriptions map to display instructions from library
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const { data } = await (supabase as any)
                    .from('work_task_templates')
                    .select('title, description')
                if (Array.isArray(data)) {
                    const map = new Map<string, string>()
                    data.forEach((t: any) => {
                        if (t.title && t.description) {
                            map.set(t.title.trim().toLowerCase(), t.description)
                        }
                    })
                    setTemplatesMap(map)
                }
            } catch (err) {
                console.error('Fetch templates for descriptions error:', err)
            }
        }
        fetchTemplates()
    }, [])

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

            const matchedDesc = templatesMap.get(contentTrimmed.toLowerCase()) || null
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .insert({
                    plan_id: activePlan.id,
                    system_code: systemCode,
                    company_id: companyId,
                    plan_date: selectedDate,
                    sort_order: nextOrder,
                    content: contentTrimmed,
                    description: matchedDesc,
                    category: newCategory,
                    priority: newPriority,
                    work_nature: newWorkNature,
                    location_note: newLocation.trim() || null,
                    assignees: finalAssignees,
                    status: 'pending',
                    progress_percent: 0,
                    workload_metrics: {
                        task_type: newTaskType,
                    },
                })
                .select('*')
                .single()

            if (error) throw error
            setItems(prev => [...prev, data])
            setNewContent('')
            setNewLocation('')
            setNewAssignees([])
            setAssigneeInput('')
            setNewTaskType('primary')
            setNewWorkNature('labor')
            showToast(`Đã thêm mục #${nextOrder} vào kế hoạch`, 'success')
        } catch (err) {
            console.error('Add item error:', err)
            showToast('Không thể thêm công việc, vui lòng thử lại', 'error')
        } finally {
            setAddingItem(false)
        }
    }

    // Toggle Task Type (Việc chính <-> Việc phụ / Hỗ trợ)
    const handleToggleTaskType = async (item: WorkPlanItem) => {
        const currentType: WorkPlanTaskType = item.workload_metrics?.task_type || 'primary'
        const nextType: WorkPlanTaskType = currentType === 'primary' ? 'secondary' : 'primary'
        try {
            const nextWl: WorkloadMetrics = {
                ...(item.workload_metrics || {}),
                task_type: nextType,
            }
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({ workload_metrics: nextWl, updated_at: new Date().toISOString() })
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
            showToast(
                `Đã chuyển thành ${nextType === 'secondary' ? '➕ Việc phụ / Tăng cường (Điểm hỗ trợ tích lũy theo kỳ)' : '⭐ Việc chính trong ca (Chuẩn 100đ)'}!`,
                'success'
            )
        } catch (err) {
            console.error('Toggle task type error:', err)
            showToast('Không thể đổi loại việc', 'error')
        }
    }

    // Toggle Work Nature (Lao động tay chân <-> Thống kê / Ghi chép)
    const handleToggleWorkNature = async (item: WorkPlanItem) => {
        const current: WorkPlanWorkNature = item.work_nature || 'labor'
        const next: WorkPlanWorkNature = current === 'labor' ? 'statistics' : 'labor'
        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({ work_nature: next, updated_at: new Date().toISOString() })
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
            showToast(
                next === 'statistics'
                    ? '📊 Đã đánh dấu công việc Thống kê / Ghi chép — bước Báo cáo sẽ không ghi sản lượng & giờ làm'
                    : '🏋️ Đã chuyển về công việc Lao động tay chân (có sản lượng & giờ làm)',
                'success'
            )
        } catch (err) {
            console.error('Toggle work nature error:', err)
            showToast('Không thể đổi bản chất công việc', 'error')
        }
    }

    // Add Template from Library into active plan
    const handleAddTemplateToPlan = async (template: WorkTaskTemplate) => {
        try {
            const activePlan = await ensurePlanRecord()
            const startOrder =
                items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1

            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .insert({
                    plan_id: activePlan.id,
                    system_code: systemCode,
                    company_id: companyId,
                    plan_date: selectedDate,
                    sort_order: startOrder,
                    content: template.title,
                    description: template.description || null,
                    category: template.category,
                    priority: template.default_priority,
                    work_nature: 'labor',
                    location_note: template.target_system_name || null,
                    assignees: [],
                    status: 'pending',
                    progress_percent: 0,
                    workload_metrics: {
                        task_type: 'primary',
                    },
                })
                .select('*')
                .single()

            if (error) throw error
            setItems(prev => [...prev, data])
            setActiveTab('dispatch')
            showToast(`Đã thêm việc "${template.title}" vào ca làm việc!`, 'success')
        } catch (err) {
            console.error('Error adding template to plan:', err)
            showToast('Không thể thêm công việc từ thư viện', 'error')
        }
    }

    // Add Multiple Templates from Library
    const handleAddMultipleTemplatesToPlan = async (templatesToAdd: WorkTaskTemplate[]) => {
        if (templatesToAdd.length === 0) return
        try {
            const activePlan = await ensurePlanRecord()
            const startOrder =
                items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 1

            const rowsToInsert = templatesToAdd.map((t, idx) => ({
                plan_id: activePlan.id,
                system_code: systemCode,
                company_id: companyId,
                plan_date: selectedDate,
                sort_order: startOrder + idx,
                content: t.title,
                description: t.description || null,
                category: t.category,
                priority: t.default_priority,
                work_nature: 'labor',
                location_note: t.target_system_name || null,
                assignees: [],
                status: 'pending',
                progress_percent: 0,
                workload_metrics: {
                    task_type: 'primary',
                },
            }))

            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .insert(rowsToInsert)
                .select('*')

            if (error) throw error
            setItems(prev => [...prev, ...(data || [])])
            setActiveTab('dispatch')
            showToast(`Đã thêm ${rowsToInsert.length} công việc từ thư viện vào ca!`, 'success')
        } catch (err) {
            console.error('Error adding templates to plan:', err)
            showToast('Không thể thêm công việc từ thư viện', 'error')
        }
    }

    // Save existing plan item to template library
    const handleSaveItemAsTemplate = (item: WorkPlanItem) => {
        const storageKey = `wms_task_library_all`
        try {
            let list: WorkTaskTemplate[] = []
            const raw = localStorage.getItem(storageKey)
            if (raw) {
                list = JSON.parse(raw)
            }
            if (list.some(t => t.title.trim().toLowerCase() === item.content.trim().toLowerCase())) {
                showToast(`Công việc này đã có sẵn trong Thư viện mẫu!`, 'info')
                return
            }
            const newTpl: WorkTaskTemplate = {
                id: `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                title: item.content,
                category: item.category || 'Vận hành kho',
                default_priority: item.priority || 'normal',
                target_system_code: currentSystem?.code || 'ALL',
                target_system_name: currentSystem?.name || 'Dùng chung',
                description: null,
                created_at: new Date().toISOString(),
            }
            const updated = [newTpl, ...list]
            localStorage.setItem(storageKey, JSON.stringify(updated))
            showToast(`Đã lưu "${item.content}" vào Thư viện mẫu!`, 'success')
        } catch (err) {
            console.error('Save template error:', err)
            showToast('Không thể lưu công việc mẫu', 'error')
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
                description: src.description || null,
                category: src.category,
                priority: src.priority,
                work_nature: src.work_nature || 'labor',
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

    // Start Editing Item (Content, Description, Location)
    const startEditingItem = (item: WorkPlanItem) => {
        setEditingItemId(item.id)
        setEditingContent(item.content)
        setEditingLocation(item.location_note || '')
        const currentDesc =
            item.description !== null && item.description !== undefined
                ? item.description
                : templatesMap.get(item.content.trim().toLowerCase()) || ''
        setEditingDescription(currentDesc)
    }

    // Inline Edit Save
    const handleSaveInlineEdit = async (item: WorkPlanItem) => {
        if (!editingContent.trim()) return
        try {
            // Cho phép chuỗi rỗng "" để người dùng có thể xóa hoàn toàn mô tả nếu muốn
            const nextDesc = editingDescription.trim()
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update({
                    content: editingContent.trim(),
                    description: nextDesc,
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
            showToast('Đã cập nhật mô tả & nội dung công việc hôm nay', 'success')
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
                task_type: 'primary',
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

    // Chuyển đổi Việc chính <-> Việc phụ cho riêng từng nhân sự được giao
    const handleToggleAssigneeTaskType = async (
        item: WorkPlanItem,
        assigneeName: string
    ) => {
        const currentList = Array.isArray(item.assignees) ? item.assignees : []
        let nextTaskType: WorkPlanTaskType = 'primary'
        const nextList: WorkPlanAssignee[] = currentList.map(a => {
            if (a.name === assigneeName) {
                const cur = a.task_type || 'primary'
                nextTaskType = cur === 'secondary' ? 'primary' : 'secondary'
                return { ...a, task_type: nextTaskType }
            }
            return a
        })

        // Đồng bộ sang assignee_evaluations nếu đã có
        const nextEvaluations = Array.isArray(item.assignee_evaluations)
            ? item.assignee_evaluations.map(ev => {
                  if (ev.assignee_name.trim().toLowerCase() === assigneeName.trim().toLowerCase()) {
                      return { ...ev, task_type: nextTaskType }
                  }
                  return ev
              })
            : undefined

        const updatePayload: any = { assignees: nextList }
        if (nextEvaluations) {
            updatePayload.assignee_evaluations = nextEvaluations
        }

        try {
            const { data, error } = await (supabase as any)
                .from('work_plan_items')
                .update(updatePayload)
                .eq('id', item.id)
                .eq('system_code', systemCode)
                .select('*')
                .single()
            if (error) throw error
            setItems(prev => prev.map(i => (i.id === item.id ? data : i)))
        } catch (err) {
            console.error('Toggle assignee task type error:', err)
        }
    }

    const handleToggleNewAssigneeTaskType = (assigneeName: string) => {
        setNewAssignees(prev =>
            prev.map(a => {
                if (a.name === assigneeName) {
                    const cur = a.task_type || 'primary'
                    return {
                        ...a,
                        task_type: cur === 'secondary' ? 'primary' : 'secondary',
                    }
                }
                return a
            })
        )
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
            {/* Top Page Header & 4-Step Workflow Navigation */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 text-white flex items-center justify-center shadow-md shrink-0">
                        <ClipboardCheck size={26} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-lg sm:text-xl font-extrabold text-stone-900">
                                Quản Lý Công Việc & Đánh Giá KPI Nhân Sự
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {systemName}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
                            Quy trình 5 trang chuyên biệt: 1. Thư viện mẫu → 2. Giao việc ca → 3. Đánh giá KPI → 4. Báo cáo & Xếp hạng → 5. Quy chế KPI
                        </p>
                    </div>
                </div>

                {/* 5 Top-level Tabs Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 bg-stone-100 p-1.5 rounded-2xl border border-stone-200 self-stretch lg:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('library')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'library'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white/80 text-stone-700 hover:bg-white hover:text-indigo-600'
                        }`}
                    >
                        <BookmarkPlus size={14} />
                        <span>1. Thư Viện Mẫu</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('dispatch')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'dispatch'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white/80 text-stone-700 hover:bg-white hover:text-indigo-600'
                        }`}
                    >
                        <Calendar size={14} />
                        <span>2. Giao Việc Ca</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('evaluate')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'evaluate'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white/80 text-stone-700 hover:bg-white hover:text-emerald-700'
                        }`}
                    >
                        <Star size={14} />
                        <span>3. Đánh Giá KPI</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('reports')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'reports'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white/80 text-stone-700 hover:bg-white hover:text-purple-700'
                        }`}
                    >
                        <BarChart3 size={14} />
                        <span>4. Báo Cáo Xếp Hạng</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('rules')}
                        className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                            activeTab === 'rules'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-white/80 text-stone-700 hover:bg-white hover:text-amber-700'
                        }`}
                        title="Xem cẩm nang quy chế chấm điểm, thưởng phạt & xếp loại KPI"
                    >
                        <BookOpen size={14} />
                        <span>5. Quy Chế KPI</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: THƯ VIỆN CÔNG VIỆC MẪU */}
            {activeTab === 'library' && (
                <TaskLibraryTab
                    systemCode={systemCode}
                    systemName={systemName}
                    onAddTemplateToPlan={handleAddTemplateToPlan}
                    onAddMultipleTemplatesToPlan={handleAddMultipleTemplatesToPlan}
                />
            )}

            {/* TAB 4: BÁO CÁO & XẾP HẠNG KPI */}
            {activeTab === 'reports' && (
                <WorkPlanAnalyticsTab
                    systemCode={systemCode}
                    systemName={systemName}
                    companyId={companyId}
                />
            )}

            {/* TAB 5: CẨM NANG & BỘ QUY TẮC CHẤM ĐIỂM KPI */}
            {activeTab === 'rules' && (
                <KpiRulesHandbookTab
                    systemName={systemName}
                    onNavigateTab={tab => setActiveTab(tab)}
                />
            )}

            {/* TAB 2 & 3: KẾ HOẠCH GIAO VIỆC HOẶC NGHIỆM THU ĐÁNH GIÁ */}
            {(activeTab === 'dispatch' || activeTab === 'evaluate') && (
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

                            {/* Shift Selector & Workflow Quick Navigation */}
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

                                {activeTab === 'dispatch' ? (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('evaluate')}
                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs"
                                        title="Chuyển sang bước nghiệm thu và chấm điểm cuối ca"
                                    >
                                        <span>Sang Bước 3: Đánh giá KPI</span>
                                        <ArrowRight size={13} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('dispatch')}
                                        className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-2xs"
                                        title="Quay lại phân công và giao việc"
                                    >
                                        <span>← Quay lại Giao việc</span>
                                    </button>
                                )}
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
                                {activeTab === 'dispatch' && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowLibraryPicker(true)}
                                            className="px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all"
                                        >
                                            <BookmarkPlus size={15} />
                                            📋 Chọn từ Thư viện mẫu
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowBulkModal(true)}
                                            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                                        >
                                            <ClipboardPaste size={15} />
                                            Nhập nhanh nhiều dòng
                                        </button>
                                    </>
                                )}

                                {activeTab === 'evaluate' && items.length > 0 && (
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
                                            Chuyển việc tồn sang mai
                                        </button>
                                    </>
                                )}

                                {items.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExportDefaultMode(
                                                activeTab === 'evaluate'
                                                    ? 'evaluation'
                                                    : 'plan'
                                            )
                                            setShowExportModal(true)
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-white text-stone-900 hover:bg-stone-100 text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition-all"
                                    >
                                        <FileImage size={15} className="text-indigo-600" />
                                        Xuất Phiếu Zalo
                                    </button>
                                )}
                            </div>
                        </div>

                        <QuickAssignForm
                            activeTab={activeTab}
                            plan={plan}
                            items={items}
                            newContent={newContent}
                            setNewContent={setNewContent}
                            newCategory={newCategory}
                            setNewCategory={setNewCategory}
                            newPriority={newPriority}
                            setNewPriority={setNewPriority}
                            newWorkNature={newWorkNature}
                            setNewWorkNature={setNewWorkNature}
                            newAssignees={newAssignees}
                            setNewAssignees={setNewAssignees}
                            assigneeInput={assigneeInput}
                            setAssigneeInput={setAssigneeInput}
                            availableAssignees={availableAssignees}
                            addingItem={addingItem}
                            handleAddSingleItem={handleAddSingleItem}
                            handleToggleNewAssigneeTaskType={handleToggleNewAssigneeTaskType}
                        />


                        {/* MODE 2: Banner Nghiệm thu (Chỉ hiện khi ở Tab 3: Đánh Giá KPI) */}
                        {activeTab === 'evaluate' && (
                            <div className="p-3.5 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-emerald-950 font-bold">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                    <span>Chế độ Nghiệm Thu Cuối Ca: Chấm sao chất lượng, tiến độ %, chia sản lượng & ghi nhận lỗi vi phạm xét KPI</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('reports')}
                                    className="text-xs font-black text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
                                >
                                    <span>Xem Bảng Xếp Hạng KPI</span>
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        )}

                        <WorkItemsList
                            activeTab={activeTab}
                            loading={loading}
                            plan={plan}
                            items={items}
                            selectedDate={selectedDate}
                            templatesMap={templatesMap}
                            editingItemId={editingItemId}
                            setEditingItemId={setEditingItemId}
                            editingContent={editingContent}
                            setEditingContent={setEditingContent}
                            editingDescription={editingDescription}
                            setEditingDescription={setEditingDescription}
                            editingLocation={editingLocation}
                            setEditingLocation={setEditingLocation}
                            addingAssigneeForItemId={addingAssigneeForItemId}
                            setAddingAssigneeForItemId={setAddingAssigneeForItemId}
                            inlineAssigneeText={inlineAssigneeText}
                            setInlineAssigneeText={setInlineAssigneeText}
                            startEditingItem={startEditingItem}
                            handleSaveInlineEdit={handleSaveInlineEdit}
                            handleMoveItem={handleMoveItem}
                            handleDeleteItem={handleDeleteItem}
                            handleToggleWorkNature={handleToggleWorkNature}
                            handleSaveItemAsTemplate={handleSaveItemAsTemplate}
                            handleAddAssigneeToRow={handleAddAssigneeToRow}
                            handleRemoveAssigneeFromRow={handleRemoveAssigneeFromRow}
                            handleToggleAssigneeTaskType={handleToggleAssigneeTaskType}
                            setShowBulkModal={setShowBulkModal}
                            setItemForWorkloadModal={setItemForWorkloadModal}
                            setItemToEvaluate={setItemToEvaluate}
                            setLightboxImages={setLightboxImages}
                            setLightboxIndex={setLightboxIndex}
                            setShowLightbox={setShowLightbox}
                        />

                        {/* Step Transition Action Bars */}
                        {activeTab === 'dispatch' && (
                            <div className="p-4 bg-indigo-50/60 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-stone-600">
                                    Đang ở <b>Bước 2: Kế hoạch & Giao việc</b> ({items.length} việc). Khi hoàn tất phân công, chuyển sang bước Nghiệm thu & Chấm điểm.
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('evaluate')}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                                >
                                    <span>Chuyển sang Bước 3: Đánh Giá & Chấm Điểm Cuối Ca</span>
                                    <ArrowRight size={15} />
                                </button>
                            </div>
                        )}

                        {activeTab === 'evaluate' && (
                            <div className="p-4 bg-purple-50/60 border-t border-purple-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="text-xs text-stone-600">
                                    Đã hoàn tất nghiệm thu ca làm việc. Bấm để xem Báo cáo tổng hợp và Bảng xếp hạng KPI thi đua.
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('reports')}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                                >
                                    <span>Xem Bước 4: Báo Cáo Tổng Hợp & Bảng Xếp Hạng KPI</span>
                                    <ArrowRight size={15} />
                                </button>
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
                                        <div className="text-amber-900 font-bold flex items-center gap-1.5">
                                            <span className="text-amber-600">📌</span>
                                            <span>* Ghi chú: Kế hoạch có thể thay đổi theo công việc phát sinh.</span>
                                        </div>
                                        <div>
                                            <b className="text-stone-800">
                                                💬 Lưu ý điều phối thêm:{' '}
                                            </b>
                                            {plan?.general_note || (
                                                <span className="italic text-stone-400">
                                                    Chưa có ghi chú riêng
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
                items={items.map(item => ({
                    ...item,
                    description:
                        item.description !== null && item.description !== undefined
                            ? item.description
                            : templatesMap.get(item.content.trim().toLowerCase()) || null,
                }))}
                planDate={selectedDate}
                systemName={systemName}
                companyName={profile?.company_name}
                defaultMode={exportDefaultMode}
            />

            <TaskLibraryPickerModal
                isOpen={showLibraryPicker}
                onClose={() => setShowLibraryPicker(false)}
                systemCode={systemCode}
                onSelectTemplates={handleAddMultipleTemplatesToPlan}
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
