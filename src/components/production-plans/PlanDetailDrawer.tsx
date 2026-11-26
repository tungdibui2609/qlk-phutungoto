'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
    Activity,
    AlertTriangle,
    ArrowDownLeft,
    ArrowRight,
    ArrowUpRight,
    Boxes,
    Calculator,
    CheckCircle2,
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    History,
    Layers,
    Loader2,
    Lock,
    PackageCheck,
    Pause,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Scale,
    Sparkles,
    Trash2,
    Unlock,
    Users,
    X
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import {
    calculatePlanMassBalance,
    formatDurationMinutes,
    recalculatePlanAggregates,
    resolveUnitWeightKg,
    syncExportedQuantitiesFromTasks
} from '@/lib/productionPlanService'
import { exportProductionPlanSettlementExcel } from '@/lib/productionPlanExcelExport'
import { PlanProductAutocomplete } from './PlanProductAutocomplete'
import {
    MassBalanceSummary,
    PLAN_MODE_CONFIG,
    PLAN_PRIORITY_CONFIG,
    PLAN_STATUS_CONFIG,
    PlanLogType,
    ProductLite,
    ProductionPlan,
    ProductionPlanAllocation,
    ProductionPlanInput,
    ProductionPlanLog,
    ProductionPlanOutput
} from './types'

export interface PlanDetailDrawerProps {
    isOpen: boolean
    onClose: () => void
    planId: string | null
    systemCode: string
    products: ProductLite[]
    isSanxuatPortal?: boolean
    onPlanChanged: () => void
    onOpenStaging: (plan: ProductionPlan) => void
    onCreateAccountingOutbound?: (plan: ProductionPlan, summary: MassBalanceSummary) => void
    onCreateAccountingInbound?: (plan: ProductionPlan, summary: MassBalanceSummary) => void
}

type DrawerTab = 'execution' | 'progress' | 'logs' | 'settlement'

const SHIFT_PRESETS = ['Ca Sáng', 'Ca Chiều', 'Ca Đêm', 'Đợt 1', 'Đợt 2', 'Đợt 3']

const LOG_ACTION_CONFIG: Record<
    PlanLogType,
    {
        shortTitle: string
        fullTitle: string
        subtitle: string
        activeClass: string
        badgeClass: string
        icon: React.ComponentType<{ size?: number; className?: string }>
    }
> = {
    ISSUE_INPUT: {
        shortTitle: 'Xuất NL ra chuyền',
        fullTitle: 'Xuất Nguyên liệu ra Chuyền sản xuất',
        subtitle: 'Rút từ Pallet đã soạn hoặc cấp thêm hàng ra lựa',
        activeClass:
            'border-blue-500 bg-blue-50/90 text-blue-800 ring-2 ring-blue-500/20 dark:bg-blue-950/50 dark:text-blue-200 dark:border-blue-500',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        icon: ArrowUpRight
    },
    PRODUCE_PRIMARY: {
        shortTitle: 'Báo TP Chính',
        fullTitle: 'Báo Sản lượng Thành phẩm Chính',
        subtitle: 'Cập nhật lũy kế thùng/khay/kg thành phẩm đạt được',
        activeClass:
            'border-emerald-500 bg-emerald-50/90 text-emerald-800 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500',
        badgeClass:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        icon: PackageCheck
    },
    PRODUCE_BYPRODUCT: {
        shortTitle: 'Thu hồi Phụ phẩm',
        fullTitle: 'Thu hồi Phụ phẩm / Hàng hạ cấp',
        subtitle: 'Hàng dạt lựa lại (Hàng C, cơm kem...) nhập kho',
        activeClass:
            'border-purple-500 bg-purple-50/90 text-purple-800 ring-2 ring-purple-500/20 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-500',
        badgeClass:
            'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        icon: Sparkles
    },
    RECORD_SCRAP: {
        shortTitle: 'Cân Phế phẩm',
        fullTitle: 'Ghi nhận Phế phẩm cân tại xưởng',
        subtitle: 'Vỏ, hạt, múi hỏng, tạp chất loại bỏ qua cân',
        activeClass:
            'border-orange-500 bg-orange-50/90 text-orange-800 ring-2 ring-orange-500/20 dark:bg-orange-950/50 dark:text-orange-200 dark:border-orange-500',
        badgeClass:
            'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        icon: Scale
    },
    RETURN_INPUT: {
        shortTitle: 'Hoàn trả NL dư',
        fullTitle: 'Hoàn trả Nguyên liệu dư về Kho',
        subtitle: 'Trừ khỏi lượng tiêu hao ròng khi chạy đủ mục tiêu',
        activeClass:
            'border-cyan-500 bg-cyan-50/90 text-cyan-800 ring-2 ring-cyan-500/20 dark:bg-cyan-950/50 dark:text-cyan-200 dark:border-cyan-500',
        badgeClass:
            'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
        icon: RotateCcw
    }
}

function fmtDateTime(iso?: string | null): string {
    if (!iso) return 'Chưa ghi nhận'
    try {
        return format(new Date(iso), 'dd/MM/yyyy HH:mm')
    } catch {
        return String(iso)
    }
}

function fmtNum(val: number | null | undefined, maxDecimals = 2): string {
    const n = Number(val) || 0
    return n.toLocaleString('vi-VN', { maximumFractionDigits: maxDecimals })
}

export function PlanDetailDrawer({
    isOpen,
    onClose,
    planId,
    systemCode,
    products,
    isSanxuatPortal = false,
    onPlanChanged,
    onOpenStaging,
    onCreateAccountingOutbound,
    onCreateAccountingInbound
}: PlanDetailDrawerProps) {
    const { showToast, showConfirm } = useToast()
    const { companyInfo } = usePrintCompanyInfo()

    const [plan, setPlan] = useState<ProductionPlan | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [syncingTasks, setSyncingTasks] = useState(false)
    const [exportingExcel, setExportingExcel] = useState(false)
    const [activeTab, setActiveTab] = useState<DrawerTab>('execution')

    // Bộ điều khiển thời gian & nhân công
    const [pausedMinutesInput, setPausedMinutesInput] = useState<string>('0')
    const [workerCountInput, setWorkerCountInput] = useState<string>('')
    const [pauseStartedAtMs, setPauseStartedAtMs] = useState<number | null>(null)

    // Form ghi nhận nhanh trong ca
    const [logType, setLogType] = useState<PlanLogType>('ISSUE_INPUT')
    const [issueSourceMode, setIssueSourceMode] = useState<'ALLOCATION' | 'PRODUCT'>('ALLOCATION')
    const [selectedAllocationId, setSelectedAllocationId] = useState<string>('')
    const [selectedInputId, setSelectedInputId] = useState<string>('')
    const [selectedOutputId, setSelectedOutputId] = useState<string>('')
    const [createNewByproduct, setCreateNewByproduct] = useState<boolean>(false)
    const [pickedProductId, setPickedProductId] = useState<string | null>(null)
    const [customItemName, setCustomItemName] = useState<string>('')
    const [qtyInput, setQtyInput] = useState<string>('')
    const [unitInput, setUnitInput] = useState<string>('Kg')
    const [weightPerUnitInput, setWeightPerUnitInput] = useState<string>('1')
    const [lotCodeInput, setLotCodeInput] = useState<string>('')
    const [productionCodeInput, setProductionCodeInput] = useState<string>('')
    const [positionCodeInput, setPositionCodeInput] = useState<string>('')
    const [shiftInput, setShiftInput] = useState<string>('Ca Sáng')
    const [operatorInput, setOperatorInput] = useState<string>('')
    const [logNotesInput, setLogNotesInput] = useState<string>('')

    // Bộ lọc Tab Nhật ký
    const [logFilterType, setLogFilterType] = useState<PlanLogType | 'ALL'>('ALL')
    const [logFilterShift, setLogFilterShift] = useState<string>('ALL')

    // Form Tab Quyết toán
    const [allowedLossInput, setAllowedLossInput] = useState<string>('5')
    const [settlementNotesInput, setSettlementNotesInput] = useState<string>('')
    const [editingInputCosts, setEditingInputCosts] = useState<Record<string, string>>({})
    const [savingCosts, setSavingCosts] = useState(false)

    // Đồng hồ tự làm mới mỗi 60s khi đang chạy SX để tính thời lượng realtime
    const [liveTick, setLiveTick] = useState(0)
    useEffect(() => {
        if (!isOpen || plan?.status !== 'IN_PROGRESS') return
        const timer = setInterval(() => setLiveTick(t => t + 1), 60000)
        return () => clearInterval(timer)
    }, [isOpen, plan?.status])

    const fetchPlanDetail = useCallback(
        async (silent = false) => {
            if (!planId) return
            if (!silent) setLoading(true)
            try {
                const { data, error } = await (supabase.from('production_plans' as any) as any)
                    .select(`
                        *,
                        customers ( id, name ),
                        productions ( id, code, name ),
                        boms ( id, code, name, quantity ),
                        outbound_orders ( id, code, status ),
                        inbound_orders ( id, code, status ),
                        production_plan_inputs (
                            *,
                            products (
                                id, name, sku, unit, internal_code, internal_name, aliases, weight_kg, cost_price, price,
                                product_units ( unit_id, conversion_rate )
                            )
                        ),
                        production_plan_outputs (
                            *,
                            products (
                                id, name, sku, unit, internal_code, internal_name, aliases, weight_kg, cost_price, price,
                                product_units ( unit_id, conversion_rate )
                            )
                        ),
                        production_plan_allocations (
                            *,
                            products ( id, name, sku, unit, internal_code, internal_name, aliases, weight_kg, cost_price, price ),
                            export_tasks ( id, code, status )
                        ),
                        production_plan_logs ( * )
                    `)
                    .eq('id', planId)
                    .eq('system_code', systemCode)
                    .single()

                if (error) throw error

                const sortedPlan: ProductionPlan = {
                    ...data,
                    production_plan_inputs: [...(data.production_plan_inputs || [])].sort(
                        (a: ProductionPlanInput, b: ProductionPlanInput) => (a.sort_order || 0) - (b.sort_order || 0)
                    ),
                    production_plan_outputs: [...(data.production_plan_outputs || [])].sort(
                        (a: ProductionPlanOutput, b: ProductionPlanOutput) => (a.sort_order || 0) - (b.sort_order || 0)
                    ),
                    production_plan_allocations: [...(data.production_plan_allocations || [])].sort(
                        (a: ProductionPlanAllocation, b: ProductionPlanAllocation) =>
                            new Date(a.allocated_at).getTime() - new Date(b.allocated_at).getTime()
                    ),
                    production_plan_logs: [...(data.production_plan_logs || [])].sort(
                        (a: ProductionPlanLog, b: ProductionPlanLog) =>
                            new Date(b.event_at).getTime() - new Date(a.event_at).getTime()
                    )
                }

                setPlan(sortedPlan)
                setPausedMinutesInput(String(sortedPlan.paused_minutes || 0))
                setWorkerCountInput(sortedPlan.worker_count ? String(sortedPlan.worker_count) : '')
                setAllowedLossInput(String(sortedPlan.allowed_loss_percent ?? 5))
                setSettlementNotesInput(sortedPlan.settlement_notes || '')

                const costMap: Record<string, string> = {}
                for (const inp of sortedPlan.production_plan_inputs || []) {
                    const fallbackCost =
                        Number(inp.unit_cost) > 0
                            ? Number(inp.unit_cost)
                            : Number(inp.products?.cost_price || inp.products?.price || 0)
                    costMap[inp.id] = fallbackCost > 0 ? String(fallbackCost) : '0'
                }
                setEditingInputCosts(costMap)
            } catch (err: any) {
                showToast(`Lỗi tải chi tiết kế hoạch: ${err?.message || 'Không xác định'}`, 'error')
            } finally {
                if (!silent) setLoading(false)
            }
        },
        [planId, systemCode, showToast]
    )

    useEffect(() => {
        if (isOpen && planId) {
            fetchPlanDetail(false)
        } else if (!isOpen) {
            setPlan(null)
            setPauseStartedAtMs(null)
        }
    }, [isOpen, planId, fetchPlanDetail])

    // Đóng Drawer bằng phím Escape
    useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [isOpen, onClose])

    const inputs = useMemo(() => plan?.production_plan_inputs || [], [plan])
    const outputs = useMemo(() => plan?.production_plan_outputs || [], [plan])
    const allocations = useMemo(
        () => (plan?.production_plan_allocations || []).filter(a => a.status !== 'RELEASED'),
        [plan]
    )
    const logs = useMemo(() => plan?.production_plan_logs || [], [plan])

    const primaryOutputs = useMemo(() => outputs.filter(o => o.output_type === 'PRIMARY'), [outputs])
    const byproductOutputs = useMemo(() => outputs.filter(o => o.output_type === 'BYPRODUCT'), [outputs])
    const scrapOutputs = useMemo(() => outputs.filter(o => o.output_type === 'SCRAP'), [outputs])

    // Các Pallet đã soạn còn khả dụng để xuất ra chuyền
    const issuableAllocations = useMemo(
        () =>
            allocations.filter(a => {
                const rem = (Number(a.allocated_quantity) || 0) - (Number(a.issued_quantity) || 0)
                return rem > 0.0001 || ['RESERVED', 'STAGED', 'PARTIAL_ISSUED'].includes(a.status)
            }),
        [allocations]
    )

    // Các Pallet đã xuất ra chuyền có thể hoàn trả lại kho
    const returnableAllocations = useMemo(
        () =>
            allocations.filter(
                a => (Number(a.issued_quantity) || 0) - (Number(a.returned_quantity) || 0) > 0.0001
            ),
        [allocations]
    )

    // Tự động khởi tạo lựa chọn mặc định khi đổi loại thao tác ghi nhận
    useEffect(() => {
        setQtyInput('')
        setLogNotesInput('')

        if (logType === 'ISSUE_INPUT') {
            if (issuableAllocations.length > 0) {
                setIssueSourceMode('ALLOCATION')
                const first = issuableAllocations[0]
                setSelectedAllocationId(first.id)
                setSelectedInputId(first.plan_input_id || '')
                setPickedProductId(first.product_id)
                setUnitInput(first.unit || 'Kg')
                setWeightPerUnitInput(String(first.weight_per_unit_kg || 1))
                setLotCodeInput(first.lot_code || '')
                setProductionCodeInput(first.production_code || '')
                setPositionCodeInput(first.position_code || '')
                const rem = Math.max(
                    0,
                    Math.round(((Number(first.allocated_quantity) || 0) - (Number(first.issued_quantity) || 0)) * 1000) /
                        1000
                )
                if (rem > 0) setQtyInput(String(rem))
            } else {
                setIssueSourceMode('PRODUCT')
                setSelectedAllocationId('')
                if (inputs.length > 0) {
                    const inp = inputs[0]
                    setSelectedInputId(inp.id)
                    setPickedProductId(inp.product_id)
                    setUnitInput(inp.unit || 'Kg')
                    setWeightPerUnitInput(String(inp.weight_per_unit_kg || 1))
                } else {
                    setSelectedInputId('')
                    setPickedProductId(null)
                    setUnitInput('Kg')
                    setWeightPerUnitInput('1')
                }
                setLotCodeInput('')
                setProductionCodeInput('')
                setPositionCodeInput('')
            }
        } else if (logType === 'PRODUCE_PRIMARY') {
            if (primaryOutputs.length > 0) {
                const firstOut = primaryOutputs[0]
                setSelectedOutputId(firstOut.id)
                setPickedProductId(firstOut.product_id || null)
                setCustomItemName(firstOut.item_name)
                setUnitInput(firstOut.unit || 'Thùng')
                setWeightPerUnitInput(String(firstOut.weight_per_unit_kg || 1))
                setProductionCodeInput(firstOut.target_lot_code || '')
            } else {
                setSelectedOutputId('')
                setPickedProductId(null)
                setCustomItemName('')
                setUnitInput('Kg')
                setWeightPerUnitInput('1')
                setProductionCodeInput('')
            }
            setLotCodeInput('')
            setPositionCodeInput('')
        } else if (logType === 'PRODUCE_BYPRODUCT') {
            if (byproductOutputs.length > 0) {
                const firstByp = byproductOutputs[0]
                setCreateNewByproduct(false)
                setSelectedOutputId(firstByp.id)
                setPickedProductId(firstByp.product_id || null)
                setCustomItemName(firstByp.item_name)
                setUnitInput(firstByp.unit || 'Kg')
                setWeightPerUnitInput(String(firstByp.weight_per_unit_kg || 1))
                setProductionCodeInput(firstByp.target_lot_code || '')
            } else {
                setCreateNewByproduct(true)
                setSelectedOutputId('')
                setPickedProductId(null)
                setCustomItemName('')
                setUnitInput('Kg')
                setWeightPerUnitInput('1')
                setProductionCodeInput('')
            }
            setLotCodeInput('')
            setPositionCodeInput('')
        } else if (logType === 'RECORD_SCRAP') {
            if (scrapOutputs.length > 0) {
                const firstScr = scrapOutputs[0]
                setSelectedOutputId(firstScr.id)
                setCustomItemName(firstScr.item_name)
                setUnitInput(firstScr.unit || 'Kg')
                setWeightPerUnitInput(String(firstScr.weight_per_unit_kg || 1))
            } else {
                setSelectedOutputId('')
                setCustomItemName('Phế phẩm cân tại xưởng (Vỏ / hạt / múi hỏng)')
                setUnitInput('Kg')
                setWeightPerUnitInput('1')
            }
            setPickedProductId(null)
            setLotCodeInput('')
            setProductionCodeInput('')
            setPositionCodeInput('')
        } else if (logType === 'RETURN_INPUT') {
            if (returnableAllocations.length > 0) {
                setIssueSourceMode('ALLOCATION')
                const firstRet = returnableAllocations[0]
                setSelectedAllocationId(firstRet.id)
                setSelectedInputId(firstRet.plan_input_id || '')
                setPickedProductId(firstRet.product_id)
                setUnitInput(firstRet.unit || 'Kg')
                setWeightPerUnitInput(String(firstRet.weight_per_unit_kg || 1))
                setLotCodeInput(firstRet.lot_code || '')
                setProductionCodeInput(firstRet.production_code || '')
                setPositionCodeInput(firstRet.position_code || '')
            } else {
                setIssueSourceMode('PRODUCT')
                setSelectedAllocationId('')
                if (inputs.length > 0) {
                    const inp = inputs[0]
                    setSelectedInputId(inp.id)
                    setPickedProductId(inp.product_id)
                    setUnitInput(inp.unit || 'Kg')
                    setWeightPerUnitInput(String(inp.weight_per_unit_kg || 1))
                } else {
                    setSelectedInputId('')
                    setPickedProductId(null)
                    setUnitInput('Kg')
                    setWeightPerUnitInput('1')
                }
                setLotCodeInput('')
                setProductionCodeInput('')
                setPositionCodeInput('')
            }
        }
    }, [logType, issuableAllocations, returnableAllocations, inputs, primaryOutputs, byproductOutputs, scrapOutputs])

    // Tính toán Cân bằng Khối lượng theo thời gian thực
    const summary: MassBalanceSummary = useMemo(() => {
        void liveTick
        if (!plan) {
            return calculatePlanMassBalance(
                {
                    allowed_loss_percent: 5,
                    actual_start_at: null,
                    actual_end_at: null,
                    paused_minutes: 0,
                    worker_count: null
                },
                [],
                [],
                []
            )
        }
        return calculatePlanMassBalance(
            {
                allowed_loss_percent: Number(allowedLossInput) >= 0 ? Number(allowedLossInput) : plan.allowed_loss_percent,
                actual_start_at: plan.actual_start_at,
                actual_end_at: plan.actual_end_at,
                paused_minutes: Number(pausedMinutesInput) || plan.paused_minutes || 0,
                worker_count: workerCountInput ? Number(workerCountInput) : plan.worker_count
            },
            inputs,
            outputs,
            logs
        )
    }, [plan, inputs, outputs, logs, allowedLossInput, pausedMinutesInput, workerCountInput, liveTick])

    const computedWeightKg = useMemo(() => {
        const q = Number(qtyInput) || 0
        const w = Number(weightPerUnitInput) > 0 ? Number(weightPerUnitInput) : 1
        return Math.round(q * w * 100) / 100
    }, [qtyInput, weightPerUnitInput])

    const isLocked = plan?.status === 'COMPLETED' || plan?.status === 'CANCELED'

    // Chọn Pallet từ danh sách đã soạn
    const handleSelectAllocation = (allocId: string) => {
        setSelectedAllocationId(allocId)
        const alloc = allocations.find(a => a.id === allocId)
        if (!alloc) return
        setSelectedInputId(alloc.plan_input_id || '')
        setPickedProductId(alloc.product_id)
        setUnitInput(alloc.unit || 'Kg')
        setWeightPerUnitInput(String(alloc.weight_per_unit_kg || 1))
        setLotCodeInput(alloc.lot_code || '')
        setProductionCodeInput(alloc.production_code || '')
        setPositionCodeInput(alloc.position_code || '')
        if (logType === 'ISSUE_INPUT') {
            const rem = Math.max(
                0,
                Math.round(((Number(alloc.allocated_quantity) || 0) - (Number(alloc.issued_quantity) || 0)) * 1000) / 1000
            )
            if (rem > 0) setQtyInput(String(rem))
        }
    }

    // Chọn dòng Input có sẵn
    const handleSelectPlanInput = (inpId: string) => {
        setSelectedInputId(inpId)
        const inp = inputs.find(i => i.id === inpId)
        if (!inp) return
        setPickedProductId(inp.product_id)
        setUnitInput(inp.unit || 'Kg')
        setWeightPerUnitInput(String(inp.weight_per_unit_kg || 1))
    }

    // Chọn sản phẩm bất kỳ từ Autocomplete
    const handlePickAutocompleteProduct = (prod: ProductLite | null) => {
        setPickedProductId(prod?.id || null)
        if (!prod) return
        setCustomItemName(prod.name)

        // Nếu đang ở chế độ Xuất/Trả NL, kiểm tra xem đã có dòng input cùng product_id chưa
        if (logType === 'ISSUE_INPUT' || logType === 'RETURN_INPUT') {
            const matchedInp = inputs.find(i => i.product_id === prod.id)
            if (matchedInp) {
                setSelectedInputId(matchedInp.id)
                setUnitInput(matchedInp.unit || prod.unit || 'Kg')
                setWeightPerUnitInput(String(matchedInp.weight_per_unit_kg || resolveUnitWeightKg(prod.unit, prod)))
                return
            } else {
                setSelectedInputId('')
            }
        }

        const defaultUnit = prod.unit || 'Kg'
        setUnitInput(defaultUnit)
        setWeightPerUnitInput(String(resolveUnitWeightKg(defaultUnit, prod)))
    }

    // Bộ điều khiển Thời gian chạy thực tế
    const handleStartExecution = async () => {
        if (!plan) return
        setSubmitting(true)
        try {
            const nowIso = new Date().toISOString()
            const { error } = await (supabase.from('production_plans' as any) as any)
                .update({
                    status: 'IN_PROGRESS',
                    actual_start_at: plan.actual_start_at || nowIso,
                    updated_at: nowIso
                })
                .eq('id', plan.id)
                .eq('system_code', systemCode)

            if (error) throw error
            showToast('Đã bắt đầu bấm giờ chạy Kế hoạch Sản xuất!', 'success')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Không thể bắt đầu: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handlePauseOrResume = async () => {
        if (!plan) return
        setSubmitting(true)
        try {
            const nowIso = new Date().toISOString()
            if (plan.status === 'IN_PROGRESS') {
                setPauseStartedAtMs(Date.now())
                const { error } = await (supabase.from('production_plans' as any) as any)
                    .update({ status: 'PAUSED', updated_at: nowIso })
                    .eq('id', plan.id)
                    .eq('system_code', systemCode)
                if (error) throw error
                showToast('Đã tạm dừng chuyền sản xuất.', 'info')
            } else {
                let extraPaused = 0
                if (pauseStartedAtMs) {
                    extraPaused = Math.max(0, Math.round((Date.now() - pauseStartedAtMs) / 60000))
                }
                const nextPaused = (Number(pausedMinutesInput) || plan.paused_minutes || 0) + extraPaused
                setPauseStartedAtMs(null)
                setPausedMinutesInput(String(nextPaused))
                const { error } = await (supabase.from('production_plans' as any) as any)
                    .update({
                        status: 'IN_PROGRESS',
                        actual_start_at: plan.actual_start_at || nowIso,
                        paused_minutes: nextPaused,
                        updated_at: nowIso
                    })
                    .eq('id', plan.id)
                    .eq('system_code', systemCode)
                if (error) throw error
                showToast(
                    extraPaused > 0
                        ? `Đã tiếp tục chạy SX (cộng ${extraPaused} phút tạm dừng).`
                        : 'Đã tiếp tục chạy Kế hoạch Sản xuất!',
                    'success'
                )
            }
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi cập nhật trạng thái: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleSaveTimeAndWorkers = async () => {
        if (!plan) return
        setSubmitting(true)
        try {
            const paused = Math.max(0, Math.round(Number(pausedMinutesInput) || 0))
            const workers = workerCountInput.trim() ? Math.max(1, Math.round(Number(workerCountInput))) : null
            const { error } = await (supabase.from('production_plans' as any) as any)
                .update({
                    paused_minutes: paused,
                    worker_count: workers,
                    updated_at: new Date().toISOString()
                })
                .eq('id', plan.id)
                .eq('system_code', systemCode)
            if (error) throw error
            showToast('Đã cập nhật thời gian nghỉ ca & số nhân công!', 'success')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi lưu thông số: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Đồng bộ số lượng thực xuất từ Lệnh xuất kho (export_tasks)
    const handleSyncFromExportTasks = async () => {
        if (!plan) return
        setSyncingTasks(true)
        try {
            const res = await syncExportedQuantitiesFromTasks(plan, allocations, inputs)
            if (res.syncedCount > 0) {
                showToast(
                    `Đã đồng bộ ${res.syncedCount} Pallet (${fmtNum(res.addedKg)} Kg) từ Lệnh xuất kho!`,
                    'success'
                )
                await fetchPlanDetail(true)
                onPlanChanged()
            } else {
                showToast('Chưa có chênh lệch xuất mới nào từ Lệnh xuất kho.', 'info')
            }
        } catch (err: any) {
            showToast(`Lỗi đồng bộ Lệnh xuất: ${err?.message}`, 'error')
        } finally {
            setSyncingTasks(false)
        }
    }

    // Ghi nhận nhanh trong Ca (5 loại giao dịch)
    const handleRecordShiftLog = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!plan || isLocked) return

        const qty = Number(qtyInput)
        if (!qty || qty <= 0) {
            showToast('Vui lòng nhập số lượng hợp lệ (> 0).', 'warning')
            return
        }

        const wPerUnit = Number(weightPerUnitInput) > 0 ? Number(weightPerUnitInput) : 1
        const weightKg = Math.round(qty * wPerUnit * 100) / 100
        const cleanUnit = unitInput.trim() || 'Kg'

        setSubmitting(true)
        try {
            let finalPlanInputId: string | null = null
            let finalPlanOutputId: string | null = null
            let finalAllocationId: string | null = null
            let finalLotId: string | null = null
            let finalProductId: string | null = pickedProductId
            let finalItemName = customItemName.trim()

            // 1. Xử lý XUẤT NGUYÊN LIỆU hoặc HOÀN TRẢ NGUYÊN LIỆU
            if (logType === 'ISSUE_INPUT' || logType === 'RETURN_INPUT') {
                if (issueSourceMode === 'ALLOCATION' && selectedAllocationId) {
                    const alloc = allocations.find(a => a.id === selectedAllocationId)
                    if (!alloc) {
                        showToast('Vui lòng chọn Pallet/LOT hợp lệ.', 'warning')
                        setSubmitting(false)
                        return
                    }
                    finalAllocationId = alloc.id
                    finalPlanInputId = alloc.plan_input_id || null
                    finalLotId = alloc.lot_id
                    finalProductId = alloc.product_id
                    finalItemName = alloc.products?.name || 'Nguyên liệu từ Pallet'

                    if (logType === 'ISSUE_INPUT') {
                        const nextIssued = Math.round(((Number(alloc.issued_quantity) || 0) + qty) * 1000) / 1000
                        const nextStatus =
                            nextIssued >= (Number(alloc.allocated_quantity) || 0) - 0.0001 ? 'ISSUED' : 'PARTIAL_ISSUED'
                        const { error: upErr } = await (supabase.from('production_plan_allocations' as any) as any)
                            .update({ issued_quantity: nextIssued, status: nextStatus })
                            .eq('id', alloc.id)
                        if (upErr) throw upErr
                    } else {
                        const maxReturnable = Math.max(
                            0,
                            (Number(alloc.issued_quantity) || 0) - (Number(alloc.returned_quantity) || 0)
                        )
                        if (qty > maxReturnable + 0.001) {
                            showToast(
                                `Số lượng trả (${fmtNum(qty)}) vượt quá lượng đã xuất còn trên chuyền của Pallet này (${fmtNum(maxReturnable)} ${alloc.unit}).`,
                                'warning'
                            )
                            setSubmitting(false)
                            return
                        }
                        const nextReturned = Math.round(((Number(alloc.returned_quantity) || 0) + qty) * 1000) / 1000
                        const nextStatus =
                            nextReturned >= (Number(alloc.issued_quantity) || 0) - 0.0001 ? 'RETURNED' : alloc.status
                        const { error: upErr } = await (supabase.from('production_plan_allocations' as any) as any)
                            .update({ returned_quantity: nextReturned, status: nextStatus })
                            .eq('id', alloc.id)
                        if (upErr) throw upErr
                    }
                } else {
                    // Chọn theo Dòng Input hoặc Sản phẩm bất kỳ (rất phổ biến ở chế độ OUTPUT_DRIVEN)
                    const chosenProduct = products.find(p => p.id === pickedProductId) || null
                    if (selectedInputId) {
                        const inp = inputs.find(i => i.id === selectedInputId)
                        finalPlanInputId = inp?.id || null
                        finalProductId = inp?.product_id || pickedProductId
                        finalItemName = inp?.products?.name || chosenProduct?.name || finalItemName
                    } else if (chosenProduct) {
                        const existingInput = inputs.find(i => i.product_id === chosenProduct.id)
                        if (existingInput) {
                            finalPlanInputId = existingInput.id
                        } else if (logType === 'ISSUE_INPUT') {
                            // Tự động bổ sung dòng nguyên liệu mở vào kế hoạch để theo dõi tiến độ & giá vốn
                            const { data: createdInp, error: inpErr } = await (
                                supabase.from('production_plan_inputs' as any) as any
                            )
                                .insert({
                                    system_code: systemCode,
                                    plan_id: plan.id,
                                    product_id: chosenProduct.id,
                                    unit: cleanUnit,
                                    weight_per_unit_kg: wPerUnit,
                                    required_quantity: 0,
                                    is_open_quantity: true,
                                    unit_cost: Number(chosenProduct.cost_price || chosenProduct.price || 0),
                                    sort_order: inputs.length + 1,
                                    notes: 'Bổ sung trực tiếp trong ca sản xuất'
                                })
                                .select()
                                .single()
                            if (!inpErr && createdInp) {
                                finalPlanInputId = createdInp.id
                            }
                        }
                        finalProductId = chosenProduct.id
                        finalItemName = chosenProduct.name
                    }

                    if (!finalProductId && !finalItemName) {
                        showToast('Vui lòng chọn Nguyên liệu cần ghi nhận.', 'warning')
                        setSubmitting(false)
                        return
                    }
                }
            }

            // 2. Xử lý BÁO SẢN LƯỢNG THÀNH PHẨM CHÍNH
            if (logType === 'PRODUCE_PRIMARY') {
                if (selectedOutputId) {
                    const out = primaryOutputs.find(o => o.id === selectedOutputId)
                    if (out) {
                        finalPlanOutputId = out.id
                        finalProductId = out.product_id || null
                        finalItemName = out.products?.name || out.item_name
                    }
                } else {
                    const chosenProd = products.find(p => p.id === pickedProductId) || null
                    const newName = chosenProd?.name || customItemName.trim()
                    if (!newName) {
                        showToast('Vui lòng chọn hoặc nhập tên Thành phẩm chính.', 'warning')
                        setSubmitting(false)
                        return
                    }
                    const { data: newOut, error: outErr } = await (
                        supabase.from('production_plan_outputs' as any) as any
                    )
                        .insert({
                            system_code: systemCode,
                            plan_id: plan.id,
                            product_id: chosenProd?.id || null,
                            item_name: newName,
                            output_type: 'PRIMARY',
                            unit: cleanUnit,
                            weight_per_unit_kg: wPerUnit,
                            target_quantity: 0,
                            produced_quantity: 0,
                            target_lot_code: productionCodeInput.trim() || null,
                            sort_order: outputs.length + 1
                        })
                        .select()
                        .single()
                    if (outErr) throw outErr
                    finalPlanOutputId = newOut.id
                    finalProductId = chosenProd?.id || null
                    finalItemName = newName
                }
            }

            // 3. Xử lý THU HỒI PHỤ PHẨM / HÀNG HẠ CẤP
            if (logType === 'PRODUCE_BYPRODUCT') {
                if (!createNewByproduct && selectedOutputId) {
                    const out = byproductOutputs.find(o => o.id === selectedOutputId)
                    if (out) {
                        finalPlanOutputId = out.id
                        finalProductId = out.product_id || null
                        finalItemName = out.products?.name || out.item_name
                    }
                } else {
                    const chosenProd = products.find(p => p.id === pickedProductId) || null
                    const bypName = chosenProd?.name || customItemName.trim()
                    if (!bypName) {
                        showToast('Vui lòng chọn sản phẩm hoặc nhập tên Phụ phẩm thu hồi (VD: Hàng C, Cơm kem...).', 'warning')
                        setSubmitting(false)
                        return
                    }
                    const { data: newByp, error: bypErr } = await (
                        supabase.from('production_plan_outputs' as any) as any
                    )
                        .insert({
                            system_code: systemCode,
                            plan_id: plan.id,
                            product_id: chosenProd?.id || null,
                            item_name: bypName,
                            output_type: 'BYPRODUCT',
                            unit: cleanUnit,
                            weight_per_unit_kg: wPerUnit,
                            target_quantity: 0,
                            produced_quantity: 0,
                            target_lot_code: productionCodeInput.trim() || null,
                            cost_allocation_ratio: 0,
                            sort_order: outputs.length + 1
                        })
                        .select()
                        .single()
                    if (bypErr) throw bypErr
                    finalPlanOutputId = newByp.id
                    finalProductId = chosenProd?.id || null
                    finalItemName = bypName
                }
            }

            // 4. Xử lý GHI NHẬN PHẾ PHẨM CÂN TẠI XƯỞNG
            if (logType === 'RECORD_SCRAP') {
                if (selectedOutputId) {
                    const out = scrapOutputs.find(o => o.id === selectedOutputId)
                    if (out) {
                        finalPlanOutputId = out.id
                        finalItemName = out.item_name
                    }
                }
                if (!finalItemName) {
                    finalItemName = 'Phế phẩm cân tại xưởng (Vỏ / hạt / hư hỏng)'
                }
            }

            // Insert dòng log vào production_plan_logs
            const { error: logErr } = await (supabase.from('production_plan_logs' as any) as any).insert({
                system_code: systemCode,
                plan_id: plan.id,
                log_type: logType,
                plan_input_id: finalPlanInputId,
                plan_output_id: finalPlanOutputId,
                allocation_id: finalAllocationId,
                lot_id: finalLotId,
                product_id: finalProductId,
                item_name: finalItemName || 'Hạng mục sản xuất',
                lot_code: lotCodeInput.trim() || null,
                production_code: productionCodeInput.trim() || null,
                position_code: positionCodeInput.trim() || null,
                quantity: qty,
                unit: cleanUnit,
                weight_kg: weightKg,
                shift_name: shiftInput.trim() || null,
                operator_name: operatorInput.trim() || null,
                event_at: new Date().toISOString(),
                notes: logNotesInput.trim() || null
            })

            if (logErr) throw logErr

            // Nếu kế hoạch chưa ở trạng thái đang chạy thì tự động kích hoạt IN_PROGRESS
            if (['DRAFT', 'APPROVED', 'STAGING'].includes(plan.status)) {
                await (supabase.from('production_plans' as any) as any)
                    .update({
                        status: 'IN_PROGRESS',
                        actual_start_at: plan.actual_start_at || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', plan.id)
                    .eq('system_code', systemCode)
            }

            await recalculatePlanAggregates(plan.id)

            showToast(
                `Đã ghi nhận: ${LOG_ACTION_CONFIG[logType].shortTitle} — ${fmtNum(qty)} ${cleanUnit} (${fmtNum(weightKg)} Kg)`,
                'success'
            )

            setQtyInput('')
            setLogNotesInput('')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi ghi nhận đợt chạy: ${err?.message || 'Không xác định'}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Xóa dòng nhật ký nhập nhầm & hoàn lại số lượng trên Allocation
    const handleDeleteLog = async (log: ProductionPlanLog) => {
        if (!plan || isLocked) return
        const ok = await showConfirm(
            `Xóa dòng nhật ký "${LOG_ACTION_CONFIG[log.log_type]?.shortTitle}: ${fmtNum(log.quantity)} ${log.unit} ${log.item_name}"? Hệ thống sẽ tự động tính lại toàn bộ lũy kế.`
        )
        if (!ok) return

        setSubmitting(true)
        try {
            if (log.allocation_id) {
                const alloc = (plan.production_plan_allocations || []).find(a => a.id === log.allocation_id)
                if (alloc) {
                    if (log.log_type === 'ISSUE_INPUT') {
                        const revertedIssued = Math.max(
                            0,
                            Math.round(((Number(alloc.issued_quantity) || 0) - Number(log.quantity)) * 1000) / 1000
                        )
                        const revertedStatus =
                            revertedIssued <= 0.0001
                                ? alloc.export_task_id
                                    ? 'STAGED'
                                    : 'RESERVED'
                                : revertedIssued >= (Number(alloc.allocated_quantity) || 0) - 0.0001
                                  ? 'ISSUED'
                                  : 'PARTIAL_ISSUED'

                        await (supabase.from('production_plan_allocations' as any) as any)
                            .update({ issued_quantity: revertedIssued, status: revertedStatus })
                            .eq('id', alloc.id)
                    } else if (log.log_type === 'RETURN_INPUT') {
                        const revertedReturned = Math.max(
                            0,
                            Math.round(((Number(alloc.returned_quantity) || 0) - Number(log.quantity)) * 1000) / 1000
                        )
                        const revertedStatus =
                            (Number(alloc.issued_quantity) || 0) >= (Number(alloc.allocated_quantity) || 0) - 0.0001
                                ? 'ISSUED'
                                : 'PARTIAL_ISSUED'

                        await (supabase.from('production_plan_allocations' as any) as any)
                            .update({ returned_quantity: revertedReturned, status: revertedStatus })
                            .eq('id', alloc.id)
                    }
                }
            }

            const { error } = await (supabase.from('production_plan_logs' as any) as any)
                .delete()
                .eq('id', log.id)
                .eq('system_code', systemCode)

            if (error) throw error

            await recalculatePlanAggregates(plan.id)
            showToast('Đã xóa dòng nhật ký và cập nhật lại số liệu cân bằng!', 'success')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Không thể xóa nhật ký: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Cập nhật đơn giá vốn nguyên liệu để tính giá thành kế toán
    const handleSaveInputCosts = async () => {
        if (!plan || isLocked) return
        setSavingCosts(true)
        try {
            for (const inp of inputs) {
                const rawCost = Number(editingInputCosts[inp.id] || 0)
                if (rawCost !== Number(inp.unit_cost)) {
                    await (supabase.from('production_plan_inputs' as any) as any)
                        .update({ unit_cost: Math.max(0, rawCost) })
                        .eq('id', inp.id)
                }
            }
            const nextAllowedLoss = Math.max(0, Number(allowedLossInput) || 0)
            if (nextAllowedLoss !== Number(plan.allowed_loss_percent)) {
                await (supabase.from('production_plans' as any) as any)
                    .update({ allowed_loss_percent: nextAllowedLoss, updated_at: new Date().toISOString() })
                    .eq('id', plan.id)
            }
            showToast('Đã cập nhật đơn giá vốn nguyên liệu & định mức hao hụt!', 'success')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi lưu đơn giá vốn: ${err?.message}`, 'error')
        } finally {
            setSavingCosts(false)
        }
    }

    // Chốt Kết Thúc & Quyết Toán Kế Hoạch
    const handleSettleAndCompletePlan = async () => {
        if (!plan) return

        if (summary.netInputKg <= 0 && summary.totalRecoverableOutputKg <= 0) {
            showToast('Chưa có số liệu xuất nguyên liệu hoặc sản lượng đầu ra để chốt quyết toán.', 'warning')
            return
        }

        if (summary.isOverAllowedLoss && !settlementNotesInput.trim()) {
            showToast(
                `Tỷ lệ hao hụt thực tế (${summary.lossPercent}%) đang vượt định mức cho phép (${allowedLossInput}%). Vui lòng nhập rõ Lý do giải trình vượt định mức trước khi chốt!`,
                'error'
            )
            return
        }

        const ok = await showConfirm(
            `Xác nhận CHỐT KẾT THÚC & QUYẾT TOÁN Kế hoạch ${plan.code}?\n• NL thực tiêu hao ròng: ${fmtNum(summary.netInputKg)} Kg\n• Thành phẩm chính: ${fmtNum(summary.primaryOutputKg)} Kg (${summary.primaryYieldPercent}%)\n• Phụ phẩm thu hồi: ${fmtNum(summary.byproductOutputKg)} Kg\n• Tổng hao hụt: ${fmtNum(summary.totalLossKg)} Kg (${summary.lossPercent}%)`
        )
        if (!ok) return

        setSubmitting(true)
        try {
            const { data: userRes } = await supabase.auth.getUser()
            const nowIso = new Date().toISOString()

            // Lưu đơn giá vốn nếu người dùng vừa sửa trên màn hình quyết toán
            for (const inp of inputs) {
                const rawCost = Number(editingInputCosts[inp.id] || 0)
                if (rawCost !== Number(inp.unit_cost)) {
                    await (supabase.from('production_plan_inputs' as any) as any)
                        .update({ unit_cost: Math.max(0, rawCost) })
                        .eq('id', inp.id)
                }
            }

            const { error } = await (supabase.from('production_plans' as any) as any)
                .update({
                    status: 'COMPLETED',
                    actual_start_at: plan.actual_start_at || nowIso,
                    actual_end_at: plan.actual_end_at || nowIso,
                    paused_minutes: Math.max(0, Math.round(Number(pausedMinutesInput) || plan.paused_minutes || 0)),
                    worker_count: workerCountInput.trim() ? Math.max(1, Math.round(Number(workerCountInput))) : plan.worker_count,
                    allowed_loss_percent: Math.max(0, Number(allowedLossInput) || 0),
                    settled_gross_input_kg: summary.grossInputKg,
                    settled_returned_input_kg: summary.returnedInputKg,
                    settled_net_input_kg: summary.netInputKg,
                    settled_primary_output_kg: summary.primaryOutputKg,
                    settled_byproduct_output_kg: summary.byproductOutputKg,
                    settled_scrap_kg: summary.recordedScrapKg,
                    settled_unaccounted_loss_kg: summary.unaccountedShrinkageKg,
                    settled_total_loss_kg: summary.totalLossKg,
                    settled_loss_percent: summary.lossPercent,
                    settled_yield_percent: summary.primaryYieldPercent,
                    settlement_notes: settlementNotesInput.trim() || null,
                    settled_by: userRes.user?.id || null,
                    settled_at: nowIso,
                    updated_at: nowIso
                })
                .eq('id', plan.id)
                .eq('system_code', systemCode)

            if (error) throw error

            showToast(`Đã chốt quyết toán thành công Kế hoạch ${plan.code}!`, 'success')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi khi chốt quyết toán: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    // Mở khóa lại kế hoạch đã chốt để điều chỉnh bổ sung
    const handleReopenPlan = async () => {
        if (!plan) return
        const ok = await showConfirm(
            `Mở khóa lại Kế hoạch ${plan.code} để bổ sung nhật ký hoặc điều chỉnh số liệu quyết toán?`
        )
        if (!ok) return

        setSubmitting(true)
        try {
            const { error } = await (supabase.from('production_plans' as any) as any)
                .update({
                    status: 'IN_PROGRESS',
                    actual_end_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', plan.id)
                .eq('system_code', systemCode)

            if (error) throw error
            showToast('Đã mở khóa kế hoạch, bạn có thể tiếp tục ghi nhận hoặc chỉnh sửa.', 'info')
            await fetchPlanDetail(true)
            onPlanChanged()
        } catch (err: any) {
            showToast(`Lỗi mở khóa: ${err?.message}`, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const handleExportSettlementExcel = async () => {
        if (!plan) return
        setExportingExcel(true)
        try {
            await exportProductionPlanSettlementExcel(plan, companyInfo?.name)
            showToast('Đã xuất Biên bản Quyết toán Excel thành công!', 'success')
        } catch (err: any) {
            showToast(`Lỗi xuất Excel: ${err?.message}`, 'error')
        } finally {
            setExportingExcel(false)
        }
    }

    const uniqueShifts = useMemo(() => {
        const s = new Set<string>()
        logs.forEach(l => {
            if (l.shift_name) s.add(l.shift_name)
        })
        return Array.from(s)
    }, [logs])

    const filteredLogs = useMemo(() => {
        return logs.filter(l => {
            if (logFilterType !== 'ALL' && l.log_type !== logFilterType) return false
            if (logFilterShift !== 'ALL' && (l.shift_name || '') !== logFilterShift) return false
            return true
        })
    }, [logs, logFilterType, logFilterShift])

    if (!isOpen) return null

    const modeCfg = plan ? PLAN_MODE_CONFIG[plan.plan_mode] : null
    const statusCfg = plan ? PLAN_STATUS_CONFIG[plan.status] : null
    const priorityCfg = plan ? PLAN_PRIORITY_CONFIG[plan.priority] : null
    const hasLinkedExportTasks = allocations.some(a => !!a.export_task_id)

    const byproductPctOfNet =
        summary.netInputKg > 0 ? Math.round((summary.byproductOutputKg / summary.netInputKg) * 10000) / 100 : 0

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="relative w-full max-w-5xl h-full bg-stone-50 dark:bg-zinc-950 shadow-2xl border-l border-stone-200 dark:border-zinc-800 flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* ==================== HEADER DRAWER ==================== */}
                <div className="bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 px-5 py-4 shrink-0">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                            {plan ? (
                                <>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                                            {plan.code}
                                        </span>
                                        {statusCfg && (
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${statusCfg.badgeClass}`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${statusCfg.dotClass}`} />
                                                {statusCfg.label}
                                            </span>
                                        )}
                                        {modeCfg && (
                                            <span
                                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${modeCfg.badgeClass}`}
                                            >
                                                {modeCfg.shortLabel}
                                            </span>
                                        )}
                                        {priorityCfg && (
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${priorityCfg.badgeClass}`}
                                            >
                                                {priorityCfg.label}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="mt-1.5 text-base sm:text-lg font-black text-stone-900 dark:text-zinc-100 truncate">
                                        {plan.name}
                                    </h2>
                                    <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-stone-500 dark:text-zinc-400">
                                        {plan.work_area_name && (
                                            <span>
                                                Chuyền / Khu vực:{' '}
                                                <strong className="text-stone-700 dark:text-zinc-200">
                                                    {plan.work_area_name}
                                                </strong>
                                            </span>
                                        )}
                                        {plan.requested_by_name && (
                                            <span>• Yêu cầu: {plan.requested_by_name}</span>
                                        )}
                                        {plan.customers?.name && <span>• KH: {plan.customers.name}</span>}
                                        {plan.productions?.code && <span>• LSX: {plan.productions.code}</span>}
                                    </div>
                                </>
                            ) : (
                                <div className="h-12 flex items-center gap-2 text-sm text-stone-500">
                                    <Loader2 size={18} className="animate-spin text-orange-500" />
                                    Đang tải dữ liệu Kế hoạch sản xuất...
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {plan && !isSanxuatPortal && !isLocked && (
                                <button
                                    type="button"
                                    onClick={() => onOpenStaging(plan)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800 transition-colors cursor-pointer"
                                >
                                    <Boxes size={15} />
                                    Soạn / Giữ LOT ({allocations.length})
                                </button>
                            )}

                            {plan && hasLinkedExportTasks && !isLocked && (
                                <button
                                    type="button"
                                    disabled={syncingTasks}
                                    onClick={handleSyncFromExportTasks}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 disabled:opacity-50 transition-colors cursor-pointer"
                                    title="Đồng bộ khối lượng xe nâng đã xuất thực tế từ Lệnh xuất kho"
                                >
                                    <RefreshCw size={14} className={syncingTasks ? 'animate-spin' : ''} />
                                    Đồng bộ Lệnh xuất
                                </button>
                            )}

                            {plan && (
                                <button
                                    type="button"
                                    disabled={exportingExcel}
                                    onClick={handleExportSettlementExcel}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {exportingExcel ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <FileSpreadsheet size={15} />
                                    )}
                                    Xuất Excel Quyết toán
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => fetchPlanDetail(false)}
                                className="p-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-500 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Làm mới dữ liệu"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            </button>

                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                title="Đóng (Esc)"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Thanh KPI nhanh */}
                    {plan && (
                        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                    NL Thực tiêu hao ròng
                                </div>
                                <div className="mt-0.5 text-sm font-black text-stone-900 dark:text-zinc-100">
                                    {fmtNum(summary.netInputKg)} <span className="text-xs font-semibold">Kg</span>
                                </div>
                                <div className="text-[10px] text-stone-500 dark:text-zinc-400">
                                    Xuất {fmtNum(summary.grossInputKg)} • Trả {fmtNum(summary.returnedInputKg)} Kg
                                </div>
                            </div>

                            <div className="px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    Thành phẩm chính ({summary.primaryYieldPercent}%)
                                </div>
                                <div className="mt-0.5 text-sm font-black text-stone-900 dark:text-zinc-100">
                                    {fmtNum(summary.primaryOutputKg)} <span className="text-xs font-semibold">Kg</span>
                                </div>
                                <div className="text-[10px] text-stone-500 dark:text-zinc-400">
                                    + Phụ phẩm thu hồi: {fmtNum(summary.byproductOutputKg)} Kg
                                </div>
                            </div>

                            <div
                                className={`px-3 py-2 rounded-xl border ${
                                    summary.isOverAllowedLoss
                                        ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                                        : 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/50'
                                }`}
                            >
                                <div
                                    className={`text-[10px] font-bold uppercase tracking-wider ${
                                        summary.isOverAllowedLoss
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-amber-700 dark:text-amber-400'
                                    }`}
                                >
                                    Tổng Hao hụt ({summary.lossPercent}%)
                                </div>
                                <div className="mt-0.5 text-sm font-black text-stone-900 dark:text-zinc-100">
                                    {fmtNum(summary.totalLossKg)} <span className="text-xs font-semibold">Kg</span>
                                </div>
                                <div className="text-[10px] text-stone-500 dark:text-zinc-400">
                                    Định mức: {plan.allowed_loss_percent}%{' '}
                                    {summary.isOverAllowedLoss ? '• Vượt ngưỡng!' : '• Trong ngưỡng'}
                                </div>
                            </div>

                            <div className="px-3 py-2 rounded-xl bg-stone-100/80 dark:bg-zinc-800/70 border border-stone-200 dark:border-zinc-700">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                    Thời gian chạy & Năng suất
                                </div>
                                <div className="mt-0.5 text-sm font-black text-stone-900 dark:text-zinc-100">
                                    {formatDurationMinutes(summary.activeDurationMinutes)}
                                </div>
                                <div className="text-[10px] text-stone-500 dark:text-zinc-400">
                                    {fmtNum(summary.throughputInputKgPerHour)} Kg NL/giờ
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Thanh điều hướng 4 Tab */}
                    <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-stone-100 dark:border-zinc-800 -mb-4 pb-0">
                        {[
                            {
                                id: 'execution' as DrawerTab,
                                label: '1. Thực thi theo Đợt / Ca',
                                icon: Activity
                            },
                            {
                                id: 'progress' as DrawerTab,
                                label: `2. Tiến độ Đầu vào & Đầu ra (${inputs.length}/${outputs.length})`,
                                icon: Layers
                            },
                            {
                                id: 'logs' as DrawerTab,
                                label: `3. Nhật ký Đợt chạy (${logs.length})`,
                                icon: History
                            },
                            {
                                id: 'settlement' as DrawerTab,
                                label: '4. Quyết toán Hao hụt & Kế toán',
                                icon: Calculator,
                                alert: summary.isOverAllowedLoss
                            }
                        ].map(tab => {
                            const Icon = tab.icon
                            const active = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                                        active
                                            ? 'border-orange-500 text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 rounded-t-xl'
                                            : 'border-transparent text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    <Icon size={15} />
                                    <span>{tab.label}</span>
                                    {tab.alert && (
                                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ==================== BODY DRAWER ==================== */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {loading && !plan ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-3 text-stone-400">
                            <Loader2 size={28} className="animate-spin text-orange-500" />
                            <p className="text-sm font-medium">Đang tải thông tin thực thi & cân bằng khối lượng...</p>
                        </div>
                    ) : !plan ? (
                        <div className="py-20 text-center text-sm text-stone-500">
                            Không tìm thấy dữ liệu kế hoạch sản xuất này.
                        </div>
                    ) : (
                        <>
                            {/* =================================================================
                                TAB 1: THỰC THI THEO ĐỢT / CA (EXECUTION)
                            ================================================================= */}
                            {activeTab === 'execution' && (
                                <div className="space-y-5">
                                    {/* Bộ điều khiển Thời gian chạy thực tế & Nhân công */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-4 shadow-xs">
                                        <div className="flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                                    <Clock size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-stone-800 dark:text-zinc-100">
                                                        Bộ điều khiển Thời gian chạy thực tế & Nhân sự chuyền
                                                    </h3>
                                                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                        Bắt đầu:{' '}
                                                        <strong className="text-stone-700 dark:text-zinc-200">
                                                            {fmtDateTime(plan.actual_start_at)}
                                                        </strong>
                                                        {plan.actual_end_at && (
                                                            <>
                                                                {' '}
                                                                • Kết thúc:{' '}
                                                                <strong className="text-stone-700 dark:text-zinc-200">
                                                                    {fmtDateTime(plan.actual_end_at)}
                                                                </strong>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {!isLocked && !plan.actual_start_at && (
                                                    <button
                                                        type="button"
                                                        disabled={submitting}
                                                        onClick={handleStartExecution}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <Play size={15} />
                                                        Bắt đầu chạy SX
                                                    </button>
                                                )}

                                                {!isLocked && plan.actual_start_at && (
                                                    <button
                                                        type="button"
                                                        disabled={submitting}
                                                        onClick={handlePauseOrResume}
                                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer ${
                                                            plan.status === 'IN_PROGRESS'
                                                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                                                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                        }`}
                                                    >
                                                        {plan.status === 'IN_PROGRESS' ? (
                                                            <>
                                                                <Pause size={14} />
                                                                Tạm dừng nghỉ ca
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play size={14} />
                                                                Tiếp tục chạy SX
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                                <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-zinc-800/70 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-700">
                                                    <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                                                        Nghỉ (phút):
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        disabled={isLocked}
                                                        value={pausedMinutesInput}
                                                        onChange={e => setPausedMinutesInput(e.target.value)}
                                                        className="w-16 px-2 py-1 text-xs font-bold text-right rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-zinc-800/70 px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-zinc-700">
                                                    <Users size={13} className="text-stone-400" />
                                                    <span className="text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                                                        Nhân công:
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        placeholder="SL"
                                                        disabled={isLocked}
                                                        value={workerCountInput}
                                                        onChange={e => setWorkerCountInput(e.target.value)}
                                                        className="w-14 px-2 py-1 text-xs font-bold text-right rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                    />
                                                </div>

                                                {!isLocked && (
                                                    <button
                                                        type="button"
                                                        disabled={submitting}
                                                        onClick={handleSaveTimeAndWorkers}
                                                        className="px-3 py-2 rounded-xl text-xs font-bold bg-stone-800 hover:bg-stone-900 text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 cursor-pointer"
                                                    >
                                                        Lưu giờ/người
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Thanh tiến độ nhanh các Thành phẩm mục tiêu ngay trên màn hình thực thi */}
                                        {primaryOutputs.length > 0 && (
                                            <div className="mt-4 pt-3.5 border-t border-stone-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {primaryOutputs.map(out => {
                                                    const target = Number(out.target_quantity) || 0
                                                    const done = Number(out.produced_quantity) || 0
                                                    const pct =
                                                        target > 0
                                                            ? Math.min(999, Math.round((done / target) * 1000) / 10)
                                                            : 0
                                                    const reached = target > 0 && done >= target - 0.0001
                                                    return (
                                                        <div
                                                            key={out.id}
                                                            className={`p-3 rounded-xl border transition-all ${
                                                                reached
                                                                    ? 'bg-emerald-50/90 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-700'
                                                                    : 'bg-stone-50/80 border-stone-200 dark:bg-zinc-800/50 dark:border-zinc-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-xs font-bold text-stone-800 dark:text-zinc-100 truncate">
                                                                    🎯 {out.products?.name || out.item_name}
                                                                </span>
                                                                <span
                                                                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                                                                        reached
                                                                            ? 'bg-emerald-600 text-white'
                                                                            : 'bg-stone-200/80 text-stone-700 dark:bg-zinc-700 dark:text-zinc-200'
                                                                    }`}
                                                                >
                                                                    {target > 0
                                                                        ? `${fmtNum(done)} / ${fmtNum(target)} ${out.unit} (${pct}%)`
                                                                        : `${fmtNum(done)} ${out.unit}`}
                                                                </span>
                                                            </div>
                                                            {target > 0 && (
                                                                <div className="mt-2 h-2 w-full rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden">
                                                                    <div
                                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                                            reached ? 'bg-emerald-500' : 'bg-orange-500'
                                                                        }`}
                                                                        style={{ width: `${Math.min(100, pct)}%` }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Cảnh báo nếu Kế hoạch đã khóa */}
                                    {isLocked ? (
                                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-4 flex-wrap">
                                            <div className="flex items-center gap-3">
                                                <Lock size={18} className="text-emerald-600 shrink-0" />
                                                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                                                    <strong>Kế hoạch này đã được chốt quyết toán.</strong> Để ghi nhận bổ sung hoặc sửa đổi nhật ký, hãy chuyển sang Tab{' '}
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveTab('settlement')}
                                                        className="underline font-black cursor-pointer"
                                                    >
                                                        Quyết toán Hao hụt & Kế toán
                                                    </button>{' '}
                                                    và bấm <em>Mở khóa lại kế hoạch</em>.
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Form Ghi nhận nhanh trong Ca bằng 5 nút màu trực quan */
                                        <form
                                            onSubmit={handleRecordShiftLog}
                                            className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-4 sm:p-5 shadow-xs space-y-4"
                                        >
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div>
                                                    <h3 className="text-sm font-black text-stone-900 dark:text-zinc-100">
                                                        Ghi nhận nhanh trong Đợt / Ca sản xuất
                                                    </h3>
                                                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                        Chọn thao tác bên dưới để ghi nhận xuất hàng ra chuyền, báo thành phẩm, thu hồi phụ phẩm, phế phẩm hoặc trả hàng dư
                                                    </p>
                                                </div>
                                            </div>

                                            {/* 5 Nút chọn loại giao dịch */}
                                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                {(
                                                    [
                                                        'ISSUE_INPUT',
                                                        'PRODUCE_PRIMARY',
                                                        'PRODUCE_BYPRODUCT',
                                                        'RECORD_SCRAP',
                                                        'RETURN_INPUT'
                                                    ] as PlanLogType[]
                                                ).map(typeKey => {
                                                    const cfg = LOG_ACTION_CONFIG[typeKey]
                                                    const Icon = cfg.icon
                                                    const selected = logType === typeKey
                                                    return (
                                                        <button
                                                            key={typeKey}
                                                            type="button"
                                                            onClick={() => setLogType(typeKey)}
                                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                                                                selected
                                                                    ? cfg.activeClass
                                                                    : 'border-stone-200 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900 hover:bg-stone-100/80 dark:hover:bg-zinc-800/60 text-stone-700 dark:text-zinc-300'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <Icon size={17} />
                                                                {selected && (
                                                                    <span className="w-2 h-2 rounded-full bg-current" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="text-xs font-black leading-snug">
                                                                    {cfg.shortTitle}
                                                                </div>
                                                                <div className="text-[10px] opacity-75 line-clamp-2 mt-0.5">
                                                                    {cfg.subtitle}
                                                                </div>
                                                            </div>
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            {/* Khu vực chọn Nguồn / Mặt hàng tùy theo logType */}
                                            <div className="p-4 rounded-2xl bg-stone-50/90 dark:bg-zinc-800/40 border border-stone-200/80 dark:border-zinc-800 space-y-3.5">
                                                <div className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-zinc-200">
                                                    {LOG_ACTION_CONFIG[logType].fullTitle}
                                                </div>

                                                {/* CASE 1 & 5: ISSUE_INPUT hoặc RETURN_INPUT */}
                                                {(logType === 'ISSUE_INPUT' || logType === 'RETURN_INPUT') && (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIssueSourceMode('ALLOCATION')}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                                                    issueSourceMode === 'ALLOCATION'
                                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                                        : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'
                                                                }`}
                                                            >
                                                                {logType === 'ISSUE_INPUT'
                                                                    ? `Chọn từ Pallet đã soạn (${issuableAllocations.length})`
                                                                    : `Chọn từ Pallet đã xuất (${returnableAllocations.length})`}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIssueSourceMode('PRODUCT')
                                                                    setSelectedAllocationId('')
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                                                    issueSourceMode === 'PRODUCT'
                                                                        ? 'bg-orange-600 text-white border-orange-600'
                                                                        : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'
                                                                }`}
                                                            >
                                                                Chọn Dòng nguyên liệu / Tìm SP bất kỳ (Chế độ linh hoạt)
                                                            </button>
                                                        </div>

                                                        {issueSourceMode === 'ALLOCATION' ? (
                                                            <div>
                                                                {(logType === 'ISSUE_INPUT'
                                                                    ? issuableAllocations
                                                                    : returnableAllocations
                                                                ).length === 0 ? (
                                                                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between gap-2 flex-wrap">
                                                                        <span>
                                                                            {logType === 'ISSUE_INPUT'
                                                                                ? 'Chưa có Pallet nào được soạn sẵn hoặc đã xuất hết. Bạn có thể bấm Soạn LOT hoặc chuyển sang "Tìm SP bất kỳ" để xuất trực tiếp!'
                                                                                : 'Chưa có Pallet soạn sẵn nào đã xuất ra chuyền. Hãy chuyển sang "Chọn Dòng nguyên liệu / Tìm SP bất kỳ" để ghi nhận hàng trả về kho.'}
                                                                        </span>
                                                                        {logType === 'ISSUE_INPUT' && !isSanxuatPortal && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => onOpenStaging(plan)}
                                                                                className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-bold cursor-pointer"
                                                                            >
                                                                                Mở Soạn LOT ngay
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={selectedAllocationId}
                                                                        onChange={e => handleSelectAllocation(e.target.value)}
                                                                        className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 text-stone-800 dark:text-zinc-100"
                                                                    >
                                                                        {(logType === 'ISSUE_INPUT'
                                                                            ? issuableAllocations
                                                                            : returnableAllocations
                                                                        ).map(a => {
                                                                            const remIssue = Math.max(
                                                                                0,
                                                                                (Number(a.allocated_quantity) || 0) -
                                                                                    (Number(a.issued_quantity) || 0)
                                                                            )
                                                                            const remReturn = Math.max(
                                                                                0,
                                                                                (Number(a.issued_quantity) || 0) -
                                                                                    (Number(a.returned_quantity) || 0)
                                                                            )
                                                                            return (
                                                                                <option key={a.id} value={a.id}>
                                                                                    Pallet {a.lot_code || '---'}
                                                                                    {a.production_code
                                                                                        ? ` (Lot SX: ${a.production_code})`
                                                                                        : ''}{' '}
                                                                                    • Vị trí: {a.position_code || '---'} •{' '}
                                                                                    {a.products?.name || 'SP'} —{' '}
                                                                                    {logType === 'ISSUE_INPUT'
                                                                                        ? `Còn chờ cấp: ${fmtNum(remIssue)} / ${fmtNum(a.allocated_quantity)} ${a.unit}`
                                                                                        : `Đang ở chuyền: ${fmtNum(remReturn)} ${a.unit}`}
                                                                                </option>
                                                                            )
                                                                        })}
                                                                    </select>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                {inputs.length > 0 && (
                                                                    <div>
                                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                                            Chọn nhanh từ Nguyên liệu trong Kế hoạch:
                                                                        </label>
                                                                        <select
                                                                            value={selectedInputId}
                                                                            onChange={e =>
                                                                                handleSelectPlanInput(e.target.value)
                                                                            }
                                                                            className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                                        >
                                                                            <option value="">
                                                                                -- Hoặc tìm sản phẩm khác bên cạnh --
                                                                            </option>
                                                                            {inputs.map(inp => (
                                                                                <option key={inp.id} value={inp.id}>
                                                                                    {inp.products?.name || 'SP'} (Đã cấp:{' '}
                                                                                    {fmtNum(inp.issued_quantity)} {inp.unit}
                                                                                    {inp.returned_quantity > 0
                                                                                        ? ` • Trả: ${fmtNum(inp.returned_quantity)}`
                                                                                        : ''}
                                                                                    )
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                )}
                                                                <div className={inputs.length === 0 ? 'md:col-span-2' : ''}>
                                                                    <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                                        Tìm sản phẩm bằng Tên viết tắt / Mã SKU (hỗ trợ cấp bổ sung ngoài dự kiến):
                                                                    </label>
                                                                    <PlanProductAutocomplete
                                                                        products={products}
                                                                        selectedProductId={pickedProductId}
                                                                        onSelect={handlePickAutocompleteProduct}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* CASE 2: PRODUCE_PRIMARY */}
                                                {logType === 'PRODUCE_PRIMARY' && (
                                                    <div className="space-y-3">
                                                        {primaryOutputs.length > 0 ? (
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1.5">
                                                                    Chọn Dòng Thành phẩm mục tiêu cần báo sản lượng:
                                                                </label>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                    {primaryOutputs.map(out => {
                                                                        const isSel = selectedOutputId === out.id
                                                                        const target = Number(out.target_quantity) || 0
                                                                        const done = Number(out.produced_quantity) || 0
                                                                        const pct =
                                                                            target > 0
                                                                                ? Math.round((done / target) * 100)
                                                                                : 0
                                                                        return (
                                                                            <button
                                                                                key={out.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setSelectedOutputId(out.id)
                                                                                    setPickedProductId(
                                                                                        out.product_id || null
                                                                                    )
                                                                                    setCustomItemName(out.item_name)
                                                                                    setUnitInput(out.unit || 'Thùng')
                                                                                    setWeightPerUnitInput(
                                                                                        String(
                                                                                            out.weight_per_unit_kg || 1
                                                                                        )
                                                                                    )
                                                                                    setProductionCodeInput(
                                                                                        out.target_lot_code || ''
                                                                                    )
                                                                                }}
                                                                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                                                                    isSel
                                                                                        ? 'border-emerald-500 bg-white dark:bg-zinc-900 ring-2 ring-emerald-500/20'
                                                                                        : 'border-stone-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/50'
                                                                                }`}
                                                                            >
                                                                                <div className="text-xs font-black text-stone-800 dark:text-zinc-100">
                                                                                    {out.products?.name || out.item_name}
                                                                                </div>
                                                                                <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                                                                                    Lũy kế: {fmtNum(done)}
                                                                                    {target > 0
                                                                                        ? ` / ${fmtNum(target)} ${out.unit} (${pct}%)`
                                                                                        : ` ${out.unit}`}
                                                                                </div>
                                                                            </button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                                    Chọn hoặc nhập Thành phẩm chính thu được:
                                                                </label>
                                                                <PlanProductAutocomplete
                                                                    products={products}
                                                                    selectedProductId={pickedProductId}
                                                                    onSelect={handlePickAutocompleteProduct}
                                                                    allowCustomFreeText
                                                                    customTextValue={customItemName}
                                                                    onCustomTextChange={setCustomItemName}
                                                                    placeholder="Gõ tên gõ tắt, SKU hoặc nhập tên Thành phẩm..."
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* CASE 3: PRODUCE_BYPRODUCT */}
                                                {logType === 'PRODUCE_BYPRODUCT' && (
                                                    <div className="space-y-3">
                                                        {byproductOutputs.length > 0 && (
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCreateNewByproduct(false)
                                                                        const first = byproductOutputs[0]
                                                                        if (first) {
                                                                            setSelectedOutputId(first.id)
                                                                            setUnitInput(first.unit)
                                                                            setWeightPerUnitInput(
                                                                                String(first.weight_per_unit_kg || 1)
                                                                            )
                                                                        }
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                                                                        !createNewByproduct
                                                                            ? 'bg-purple-600 text-white border-purple-600'
                                                                            : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'
                                                                    }`}
                                                                >
                                                                    Chọn Phụ phẩm đã khai báo ({byproductOutputs.length})
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setCreateNewByproduct(true)
                                                                        setSelectedOutputId('')
                                                                        setPickedProductId(null)
                                                                        setCustomItemName('')
                                                                    }}
                                                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                                                                        createNewByproduct
                                                                            ? 'bg-purple-600 text-white border-purple-600'
                                                                            : 'bg-white dark:bg-zinc-900 text-stone-600 dark:text-zinc-300 border-stone-200 dark:border-zinc-700'
                                                                    }`}
                                                                >
                                                                    <Plus size={13} />
                                                                    Thêm Phụ phẩm / Hàng hạ cấp mới
                                                                </button>
                                                            </div>
                                                        )}

                                                        {!createNewByproduct && byproductOutputs.length > 0 ? (
                                                            <select
                                                                value={selectedOutputId}
                                                                onChange={e => {
                                                                    const id = e.target.value
                                                                    setSelectedOutputId(id)
                                                                    const b = byproductOutputs.find(o => o.id === id)
                                                                    if (b) {
                                                                        setUnitInput(b.unit || 'Kg')
                                                                        setWeightPerUnitInput(
                                                                            String(b.weight_per_unit_kg || 1)
                                                                        )
                                                                        setProductionCodeInput(b.target_lot_code || '')
                                                                    }
                                                                }}
                                                                className="w-full px-3 py-2.5 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                            >
                                                                {byproductOutputs.map(b => (
                                                                    <option key={b.id} value={b.id}>
                                                                        {b.products?.name || b.item_name} — Đã thu hồi:{' '}
                                                                        {fmtNum(b.produced_quantity)} {b.unit}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                                    Chọn sản phẩm Phụ phẩm / Hàng rớt cấp (VD: Hàng C, Cơm kem...) hoặc gõ tên tự do:
                                                                </label>
                                                                <PlanProductAutocomplete
                                                                    products={products}
                                                                    selectedProductId={pickedProductId}
                                                                    onSelect={handlePickAutocompleteProduct}
                                                                    allowCustomFreeText
                                                                    customTextValue={customItemName}
                                                                    onCustomTextChange={setCustomItemName}
                                                                    placeholder="Gõ tên viết tắt, mã SKU hoặc tên Phụ phẩm thu hồi..."
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* CASE 4: RECORD_SCRAP */}
                                                {logType === 'RECORD_SCRAP' && (
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Mô tả loại Phế phẩm cân tại xưởng (Vỏ, hạt, múi hư hỏng, tạp chất...):
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={customItemName}
                                                            onChange={e => setCustomItemName(e.target.value)}
                                                            placeholder="VD: Vỏ + hạt sầu riêng, Múi sượng hư loại bỏ..."
                                                            className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                    </div>
                                                )}

                                                {/* Hàng nhập Số lượng, ĐVT, Quy Kg, Ca làm, Người thực hiện */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Số lượng đợt này *
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min={0.001}
                                                            required
                                                            value={qtyInput}
                                                            onChange={e => setQtyInput(e.target.value)}
                                                            placeholder="Nhập SL..."
                                                            className="w-full px-3 py-2 text-sm font-black rounded-xl bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-600 text-stone-900 dark:text-zinc-100 focus:outline-none focus:border-orange-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Đơn vị tính (ĐVT)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={unitInput}
                                                            onChange={e => setUnitInput(e.target.value)}
                                                            className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Quy đổi (Kg / 1 ĐVT)
                                                        </label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            min={0.0001}
                                                            value={weightPerUnitInput}
                                                            onChange={e => setWeightPerUnitInput(e.target.value)}
                                                            className="w-full px-3 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                    </div>

                                                    <div className="flex flex-col justify-end">
                                                        <div className="px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/70">
                                                            <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                                                Khối lượng quy Kg:
                                                            </div>
                                                            <div className="text-sm font-black text-orange-800 dark:text-orange-200">
                                                                {fmtNum(computedWeightKg)} Kg
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Hàng thông tin Ca / Đợt, Mã Lot SX, Người thực hiện, Ghi chú */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Ca làm việc / Đợt chạy
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={shiftInput}
                                                            onChange={e => setShiftInput(e.target.value)}
                                                            placeholder="VD: Ca Sáng, Đợt 1..."
                                                            className="w-full px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                                                            {SHIFT_PRESETS.map(s => (
                                                                <button
                                                                    key={s}
                                                                    type="button"
                                                                    onClick={() => setShiftInput(s)}
                                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                                                        shiftInput === s
                                                                            ? 'bg-orange-500 text-white'
                                                                            : 'bg-stone-200/70 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400'
                                                                    }`}
                                                                >
                                                                    {s}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Mã Lot SX (`production_code`)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={productionCodeInput}
                                                            onChange={e => setProductionCodeInput(e.target.value)}
                                                            placeholder="VD: L015DD260-TN..."
                                                            className="w-full px-3 py-2 text-xs font-mono font-semibold rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                                                            Người thực hiện / Nhận hàng
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={operatorInput}
                                                            onChange={e => setOperatorInput(e.target.value)}
                                                            placeholder="Tổ trưởng / Thủ kho..."
                                                            className="w-full px-3 py-2 text-xs font-medium rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <input
                                                        type="text"
                                                        value={logNotesInput}
                                                        onChange={e => setLogNotesInput(e.target.value)}
                                                        placeholder="Ghi chú đợt này (VD: Rút thêm Ri A ra lựa bổ sung cho đủ 500 thùng khay...)"
                                                        className="flex-1 min-w-[220px] px-3 py-2 text-xs rounded-xl bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={submitting}
                                                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-600/20 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {submitting ? (
                                                            <Loader2 size={15} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 size={15} />
                                                        )}
                                                        Lưu Ghi Nhận Đợt Này
                                                    </button>
                                                </div>
                                            </div>
                                        </form>
                                    )}

                                    {/* 5 dòng nhật ký gần nhất để người vận hành đối chiếu tức thì */}
                                    {logs.length > 0 && (
                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-4">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                                    Các lượt ghi nhận vừa thực hiện gần nhất
                                                </h4>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('logs')}
                                                    className="text-xs font-bold text-orange-600 hover:underline cursor-pointer"
                                                >
                                                    Xem toàn bộ {logs.length} dòng →
                                                </button>
                                            </div>
                                            <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                {logs.slice(0, 5).map(l => {
                                                    const cfg = LOG_ACTION_CONFIG[l.log_type]
                                                    return (
                                                        <div
                                                            key={l.id}
                                                            className="py-2 flex items-center justify-between gap-3 text-xs flex-wrap"
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span
                                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.badgeClass}`}
                                                                >
                                                                    {cfg.shortTitle}
                                                                </span>
                                                                <span className="font-bold text-stone-800 dark:text-zinc-100 truncate">
                                                                    {l.item_name}
                                                                </span>
                                                                {l.lot_code && (
                                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300">
                                                                        {l.lot_code}
                                                                    </span>
                                                                )}
                                                                {l.shift_name && (
                                                                    <span className="text-[11px] text-stone-400">
                                                                        • {l.shift_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0">
                                                                <span className="font-black text-stone-900 dark:text-zinc-100">
                                                                    {fmtNum(l.quantity)} {l.unit}{' '}
                                                                    <span className="font-normal text-stone-500">
                                                                        ({fmtNum(l.weight_kg)} Kg)
                                                                    </span>
                                                                </span>
                                                                <span className="text-[11px] text-stone-400">
                                                                    {fmtDateTime(l.event_at)}
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

                            {/* =================================================================
                                TAB 2: TIẾN ĐỘ ĐẦU VÀO & ĐẦU RA (PROGRESS)
                            ================================================================= */}
                            {activeTab === 'progress' && (
                                <div className="space-y-5">
                                    {/* Bảng Nguyên liệu Đầu vào */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                                        <div className="px-4 py-3.5 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                                            <div>
                                                <h3 className="text-sm font-black text-stone-900 dark:text-zinc-100">
                                                    I. Tiến độ Nguyên liệu Đầu vào & Thực tiêu hao ròng
                                                </h3>
                                                <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                    Thực tiêu hao ròng = Đã cấp ra chuyền (-) Hoàn trả kho nguyên trạng
                                                </p>
                                            </div>
                                            {!isSanxuatPortal && !isLocked && (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenStaging(plan)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                                                >
                                                    <Boxes size={14} />
                                                    Soạn & Giữ Pallet LOT
                                                </button>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-stone-50 dark:bg-zinc-800/70 text-stone-600 dark:text-zinc-300 border-b border-stone-200 dark:border-zinc-800">
                                                    <tr>
                                                        <th className="text-left px-4 py-2.5 font-bold">Nguyên liệu</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Yêu cầu</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Đã soạn LOT</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Đã cấp</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Hoàn trả</th>
                                                        <th className="text-right px-3 py-2.5 font-bold text-blue-700 dark:text-blue-300">
                                                            Thực tiêu hao ròng
                                                        </th>
                                                        <th className="text-right px-4 py-2.5 font-bold">Quy đổi (Kg)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                    {inputs.length === 0 ? (
                                                        <tr>
                                                            <td
                                                                colSpan={7}
                                                                className="px-4 py-8 text-center text-stone-400"
                                                            >
                                                                Chưa khai báo dòng nguyên liệu đầu vào cố định (hoặc đang chạy chế độ mở).
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        inputs.map(inp => {
                                                            const w =
                                                                Number(inp.weight_per_unit_kg) > 0
                                                                    ? Number(inp.weight_per_unit_kg)
                                                                    : 1
                                                            const netQty = Math.max(
                                                                0,
                                                                (Number(inp.issued_quantity) || 0) -
                                                                    (Number(inp.returned_quantity) || 0)
                                                            )
                                                            const netKg = netQty * w
                                                            return (
                                                                <tr
                                                                    key={inp.id}
                                                                    className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40"
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <div className="font-bold text-stone-800 dark:text-zinc-100">
                                                                            {inp.products?.name || 'Nguyên liệu'}
                                                                        </div>
                                                                        <div className="text-[10px] text-stone-500 flex items-center gap-2 mt-0.5">
                                                                            <span className="font-mono">
                                                                                SKU: {inp.products?.sku || '---'}
                                                                            </span>
                                                                            {inp.products?.aliases && (
                                                                                <span className="text-orange-600 font-bold">
                                                                                    ⚡ {inp.products.aliases}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold">
                                                                        {inp.is_open_quantity &&
                                                                        Number(inp.required_quantity) === 0 ? (
                                                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                                                                                Chế độ mở
                                                                            </span>
                                                                        ) : (
                                                                            `${fmtNum(inp.required_quantity)} ${inp.unit}`
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold text-indigo-600 dark:text-indigo-400">
                                                                        {fmtNum(inp.allocated_quantity)} {inp.unit}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold">
                                                                        {fmtNum(inp.issued_quantity)} {inp.unit}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold text-cyan-600 dark:text-cyan-400">
                                                                        {inp.returned_quantity > 0
                                                                            ? `-${fmtNum(inp.returned_quantity)} ${inp.unit}`
                                                                            : '0'}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-black text-blue-700 dark:text-blue-300">
                                                                        {fmtNum(netQty)} {inp.unit}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-black text-stone-900 dark:text-zinc-100">
                                                                        {fmtNum(netKg)} Kg
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-blue-50/60 dark:bg-blue-950/20 border-t border-stone-200 dark:border-zinc-800 font-black">
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-2.5 text-right text-blue-900 dark:text-blue-200">
                                                            Tổng khối lượng Nguyên liệu thực tiêu hao ròng:
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-blue-900 dark:text-blue-200">
                                                            {fmtNum(summary.netInputKg)} Kg
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Bảng Thành phẩm & Phụ phẩm Đầu ra */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                                        <div className="px-4 py-3.5 border-b border-stone-200 dark:border-zinc-800">
                                            <h3 className="text-sm font-black text-stone-900 dark:text-zinc-100">
                                                II. Tiến độ Thành phẩm Chính & Phụ phẩm Thu hồi Đầu ra
                                            </h3>
                                            <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                Theo dõi lũy kế đạt được so với mục tiêu kế hoạch và quy đổi Kg phục vụ cân bằng vật tư
                                            </p>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead className="bg-stone-50 dark:bg-zinc-800/70 text-stone-600 dark:text-zinc-300 border-b border-stone-200 dark:border-zinc-800">
                                                    <tr>
                                                        <th className="text-left px-4 py-2.5 font-bold">Phân loại</th>
                                                        <th className="text-left px-3 py-2.5 font-bold">Thành phẩm / Phụ phẩm</th>
                                                        <th className="text-left px-3 py-2.5 font-bold">Mã Lot TP</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Mục tiêu</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Lũy kế đạt</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Còn thiếu</th>
                                                        <th className="text-right px-3 py-2.5 font-bold">Quy đổi (Kg)</th>
                                                        <th className="text-left px-4 py-2.5 font-bold w-40">% Hoàn thành</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                    {outputs.length === 0 ? (
                                                        <tr>
                                                            <td
                                                                colSpan={8}
                                                                className="px-4 py-8 text-center text-stone-400"
                                                            >
                                                                Chưa có dòng thành phẩm/phụ phẩm nào. Khi báo sản lượng ở Tab 1 hệ thống sẽ tự động tạo dòng theo dõi!
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        outputs.map(out => {
                                                            const w =
                                                                Number(out.weight_per_unit_kg) > 0
                                                                    ? Number(out.weight_per_unit_kg)
                                                                    : 1
                                                            const target = Number(out.target_quantity) || 0
                                                            const done = Number(out.produced_quantity) || 0
                                                            const missing = Math.max(0, target - done)
                                                            const pct =
                                                                target > 0
                                                                    ? Math.round((done / target) * 1000) / 10
                                                                    : null
                                                            const reached = target > 0 && done >= target - 0.0001
                                                            return (
                                                                <tr
                                                                    key={out.id}
                                                                    className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40"
                                                                >
                                                                    <td className="px-4 py-3">
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                                                out.output_type === 'PRIMARY'
                                                                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                                                    : out.output_type === 'BYPRODUCT'
                                                                                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                                                                                      : 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                                                                            }`}
                                                                        >
                                                                            {out.output_type === 'PRIMARY'
                                                                                ? 'TP Chính'
                                                                                : out.output_type === 'BYPRODUCT'
                                                                                  ? 'Phụ phẩm'
                                                                                  : 'Phế phẩm'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-3 py-3 font-bold text-stone-800 dark:text-zinc-100">
                                                                        {out.products?.name || out.item_name}
                                                                    </td>
                                                                    <td className="px-3 py-3 font-mono text-[11px] text-stone-600 dark:text-zinc-400">
                                                                        {out.target_lot_code || '---'}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold">
                                                                        {target > 0 ? `${fmtNum(target)} ${out.unit}` : '---'}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-black text-emerald-700 dark:text-emerald-400">
                                                                        {fmtNum(done)} {out.unit}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-semibold text-stone-500">
                                                                        {target > 0
                                                                            ? missing > 0
                                                                                ? `${fmtNum(missing)} ${out.unit}`
                                                                                : 'Đủ chỉ tiêu'
                                                                            : '---'}
                                                                    </td>
                                                                    <td className="px-3 py-3 text-right font-black">
                                                                        {fmtNum(done * w)} Kg
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {pct !== null ? (
                                                                            <div>
                                                                                <div className="flex justify-between text-[10px] font-black mb-1">
                                                                                    <span
                                                                                        className={
                                                                                            reached
                                                                                                ? 'text-emerald-600'
                                                                                                : 'text-orange-600'
                                                                                        }
                                                                                    >
                                                                                        {pct}%
                                                                                    </span>
                                                                                    {reached && (
                                                                                        <span className="text-emerald-600">
                                                                                            ✓ Đạt
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                                <div className="h-1.5 rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden">
                                                                                    <div
                                                                                        className={`h-full rounded-full ${
                                                                                            reached
                                                                                                ? 'bg-emerald-500'
                                                                                                : 'bg-orange-500'
                                                                                        }`}
                                                                                        style={{
                                                                                            width: `${Math.min(100, pct)}%`
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[11px] text-stone-400">
                                                                                Thu hồi thực tế
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })
                                                    )}
                                                </tbody>
                                                <tfoot className="bg-emerald-50/60 dark:bg-emerald-950/20 border-t border-stone-200 dark:border-zinc-800 font-black">
                                                    <tr>
                                                        <td
                                                            colSpan={6}
                                                            className="px-4 py-2.5 text-right text-emerald-900 dark:text-emerald-200"
                                                        >
                                                            Tổng Khối lượng Thu hồi Nhập kho (TP Chính + Phụ phẩm):
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right text-emerald-900 dark:text-emerald-200">
                                                            {fmtNum(summary.totalRecoverableOutputKg)} Kg
                                                        </td>
                                                        <td className="px-4 py-2.5 text-emerald-700 dark:text-emerald-300">
                                                            Thu hồi {summary.totalRecoveryPercent}%
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Bảng danh sách Pallet đã soạn / giữ chỗ */}
                                    {allocations.length > 0 && (
                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                                            <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-zinc-300">
                                                    Danh sách Pallet / LOT đã soạn cho Kế hoạch ({allocations.length})
                                                </h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead className="bg-stone-50 dark:bg-zinc-800/60 text-stone-500">
                                                        <tr>
                                                            <th className="text-left px-4 py-2">Mã Pallet</th>
                                                            <th className="text-left px-3 py-2">Mã Lot SX</th>
                                                            <th className="text-left px-3 py-2">Vị trí</th>
                                                            <th className="text-left px-3 py-2">Sản phẩm</th>
                                                            <th className="text-right px-3 py-2">Đã soạn</th>
                                                            <th className="text-right px-3 py-2">Đã cấp</th>
                                                            <th className="text-right px-3 py-2">Hoàn trả</th>
                                                            <th className="text-center px-4 py-2">Lệnh xuất kho</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                        {allocations.map(a => (
                                                            <tr key={a.id}>
                                                                <td className="px-4 py-2.5 font-mono font-bold">
                                                                    {a.lot_code || '---'}
                                                                </td>
                                                                <td className="px-3 py-2.5 font-mono text-stone-600 dark:text-zinc-400">
                                                                    {a.production_code || '---'}
                                                                </td>
                                                                <td className="px-3 py-2.5">{a.position_code || '---'}</td>
                                                                <td className="px-3 py-2.5 font-semibold">
                                                                    {a.products?.name || '---'}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-bold">
                                                                    {fmtNum(a.allocated_quantity)} {a.unit}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-bold text-blue-600">
                                                                    {fmtNum(a.issued_quantity)} {a.unit}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right text-cyan-600">
                                                                    {a.returned_quantity > 0
                                                                        ? `${fmtNum(a.returned_quantity)} ${a.unit}`
                                                                        : '---'}
                                                                </td>
                                                                <td className="px-4 py-2.5 text-center">
                                                                    {a.export_tasks?.code ? (
                                                                        <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-mono text-[10px] font-bold">
                                                                            {a.export_tasks.code}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-stone-400">
                                                                            Giữ tại chỗ
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* =================================================================
                                TAB 3: NHẬT KÝ ĐỢT CHẠY (LOGS)
                            ================================================================= */}
                            {activeTab === 'logs' && (
                                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden shadow-xs">
                                    <div className="p-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setLogFilterType('ALL')}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                                    logFilterType === 'ALL'
                                                        ? 'bg-stone-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                                        : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300'
                                                }`}
                                            >
                                                Tất cả ({logs.length})
                                            </button>
                                            {(Object.keys(LOG_ACTION_CONFIG) as PlanLogType[]).map(k => {
                                                const cnt = logs.filter(l => l.log_type === k).length
                                                return (
                                                    <button
                                                        key={k}
                                                        type="button"
                                                        onClick={() => setLogFilterType(k)}
                                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                                                            logFilterType === k
                                                                ? LOG_ACTION_CONFIG[k].badgeClass
                                                                : 'border-transparent bg-stone-100/70 dark:bg-zinc-800/70 text-stone-500'
                                                        }`}
                                                    >
                                                        {LOG_ACTION_CONFIG[k].shortTitle} ({cnt})
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {uniqueShifts.length > 0 && (
                                            <select
                                                value={logFilterShift}
                                                onChange={e => setLogFilterShift(e.target.value)}
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700"
                                            >
                                                <option value="ALL">Tất cả Ca / Đợt</option>
                                                {uniqueShifts.map(s => (
                                                    <option key={s} value={s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-stone-50 dark:bg-zinc-800/70 text-stone-600 dark:text-zinc-300 border-b border-stone-200 dark:border-zinc-800">
                                                <tr>
                                                    <th className="text-left px-4 py-2.5 font-bold">Thời gian</th>
                                                    <th className="text-left px-3 py-2.5 font-bold">Ca / Đợt</th>
                                                    <th className="text-left px-3 py-2.5 font-bold">Loại giao dịch</th>
                                                    <th className="text-left px-3 py-2.5 font-bold">Sản phẩm / Hạng mục</th>
                                                    <th className="text-left px-3 py-2.5 font-bold">Pallet / Lot SX</th>
                                                    <th className="text-right px-3 py-2.5 font-bold">Số lượng</th>
                                                    <th className="text-right px-3 py-2.5 font-bold">Quy Kg</th>
                                                    <th className="text-left px-3 py-2.5 font-bold">Người TH / Ghi chú</th>
                                                    {!isLocked && (
                                                        <th className="text-center px-3 py-2.5 font-bold w-12">Xóa</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                {filteredLogs.length === 0 ? (
                                                    <tr>
                                                        <td
                                                            colSpan={isLocked ? 8 : 9}
                                                            className="px-4 py-12 text-center text-stone-400"
                                                        >
                                                            Chưa có dòng nhật ký nào khớp bộ lọc.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    filteredLogs.map(l => {
                                                        const cfg = LOG_ACTION_CONFIG[l.log_type]
                                                        return (
                                                            <tr
                                                                key={l.id}
                                                                className="hover:bg-stone-50/70 dark:hover:bg-zinc-800/40"
                                                            >
                                                                <td className="px-4 py-2.5 whitespace-nowrap text-stone-600 dark:text-zinc-400">
                                                                    {fmtDateTime(l.event_at)}
                                                                </td>
                                                                <td className="px-3 py-2.5 font-semibold">
                                                                    {l.shift_name || '---'}
                                                                </td>
                                                                <td className="px-3 py-2.5">
                                                                    <span
                                                                        className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.badgeClass}`}
                                                                    >
                                                                        {cfg.shortTitle}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2.5 font-bold text-stone-800 dark:text-zinc-100">
                                                                    {l.item_name}
                                                                </td>
                                                                <td className="px-3 py-2.5 font-mono text-[11px]">
                                                                    {l.lot_code && <div>Pallet: {l.lot_code}</div>}
                                                                    {l.production_code && (
                                                                        <div className="text-stone-500">
                                                                            Lot SX: {l.production_code}
                                                                        </div>
                                                                    )}
                                                                    {!l.lot_code && !l.production_code && '---'}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-black whitespace-nowrap">
                                                                    {fmtNum(l.quantity)} {l.unit}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-bold text-stone-700 dark:text-zinc-200 whitespace-nowrap">
                                                                    {fmtNum(l.weight_kg)} Kg
                                                                </td>
                                                                <td className="px-3 py-2.5 text-stone-600 dark:text-zinc-400 max-w-[200px]">
                                                                    {l.operator_name && (
                                                                        <span className="font-semibold text-stone-800 dark:text-zinc-200">
                                                                            [{l.operator_name}]{' '}
                                                                        </span>
                                                                    )}
                                                                    {l.notes || ''}
                                                                </td>
                                                                {!isLocked && (
                                                                    <td className="px-3 py-2.5 text-center">
                                                                        <button
                                                                            type="button"
                                                                            disabled={submitting}
                                                                            onClick={() => handleDeleteLog(l)}
                                                                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                                            title="Xóa dòng nhập nhầm & hoàn lại số liệu"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        )
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* =================================================================
                                TAB 4: QUYẾT TOÁN HAO HỤT, THỜI GIAN & KẾ TOÁN (SETTLEMENT)
                            ================================================================= */}
                            {activeTab === 'settlement' && (
                                <div className="space-y-5">
                                    {/* 1. SƠ ĐỒ CÂN BẰNG KHỐI LƯỢNG (MASS BALANCE VISUAL FLOW) */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-5 shadow-xs space-y-4">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div>
                                                <h3 className="text-sm font-black text-stone-900 dark:text-zinc-100">
                                                    Sơ đồ Cân Bằng Khối Lượng Vật Tư (Mass Balance Visual Flow)
                                                </h3>
                                                <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                    Mọi trọng lượng được quy chuẩn về Kg để đối soát chính xác 100% giữa Đầu vào ròng và Đầu ra + Hao hụt
                                                </p>
                                            </div>
                                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300">
                                                Định mức hao hụt tối đa: {allowedLossInput}%
                                            </span>
                                        </div>

                                        {/* Dòng chảy Khối lượng */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
                                            {/* Cột trái: Xuất thô - Trả kho = Thực tiêu hao ròng */}
                                            <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/25 border border-blue-200/80 dark:border-blue-900/60">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-stone-600 dark:text-zinc-300 font-medium">
                                                        1. Tổng xuất thô ra chuyền:
                                                    </span>
                                                    <span className="font-bold text-stone-900 dark:text-zinc-100">
                                                        {fmtNum(summary.grossInputKg)} Kg
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-cyan-700 dark:text-cyan-400 font-medium">
                                                        2. (-) Hoàn trả lại kho:
                                                    </span>
                                                    <span className="font-bold text-cyan-700 dark:text-cyan-300">
                                                        -{fmtNum(summary.returnedInputKg)} Kg
                                                    </span>
                                                </div>
                                                <div className="pt-2.5 border-t border-blue-200 dark:border-blue-800/80">
                                                    <div className="text-[11px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                                        (=) Thực tiêu hao ròng (100%)
                                                    </div>
                                                    <div className="mt-0.5 text-2xl font-black text-blue-900 dark:text-blue-100">
                                                        {fmtNum(summary.netInputKg)}{' '}
                                                        <span className="text-sm font-bold">Kg</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mũi tên phân nhánh */}
                                            <div className="lg:col-span-1 flex items-center justify-center text-stone-400">
                                                <ArrowRight size={26} className="hidden lg:block" />
                                                <ArrowDownLeft size={22} className="lg:hidden rotate-[-45deg]" />
                                            </div>

                                            {/* Cột phải: 3 Nhánh phân bổ (TP Chính + Phụ phẩm + Tổng Hao hụt) */}
                                            <div className="lg:col-span-6 space-y-2.5">
                                                {/* Nhánh 1: Thành phẩm chính */}
                                                <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                                                            ① Thành phẩm chính thu được
                                                        </div>
                                                        <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400">
                                                            Tỷ lệ thu hồi chính (Primary Yield)
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                                                            {fmtNum(summary.primaryOutputKg)} Kg
                                                        </div>
                                                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                            {summary.primaryYieldPercent}%
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Nhánh 2: Phụ phẩm thu hồi */}
                                                <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/70 flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="text-xs font-black text-purple-800 dark:text-purple-200">
                                                            ② Phụ phẩm / Hàng hạ cấp thu hồi nhập kho
                                                        </div>
                                                        <div className="text-[11px] text-purple-700/80 dark:text-purple-400">
                                                            Hàng dạt lựa lại vẫn còn giá trị nhập kho
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-black text-purple-900 dark:text-purple-100">
                                                            {fmtNum(summary.byproductOutputKg)} Kg
                                                        </div>
                                                        <div className="text-xs font-black text-purple-600 dark:text-purple-400">
                                                            {byproductPctOfNet}%
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Nhánh 3: Tổng Hao hụt (Phế phẩm cân được + Ngót tự nhiên) */}
                                                <div
                                                    className={`p-3 rounded-xl border ${
                                                        summary.isOverAllowedLoss
                                                            ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                                                            : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <div
                                                                className={`text-xs font-black ${
                                                                    summary.isOverAllowedLoss
                                                                        ? 'text-rose-800 dark:text-rose-200'
                                                                        : 'text-amber-900 dark:text-amber-200'
                                                                }`}
                                                            >
                                                                ③ Tổng Hao hụt thực tế
                                                            </div>
                                                            <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                                                                Định mức cho phép: {allowedLossInput}%{' '}
                                                                {summary.isOverAllowedLoss
                                                                    ? `(Vượt +${summary.lossVariancePercent}%)`
                                                                    : '(Đạt định mức)'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-stone-900 dark:text-zinc-100">
                                                                {fmtNum(summary.totalLossKg)} Kg
                                                            </div>
                                                            <div
                                                                className={`text-xs font-black ${
                                                                    summary.isOverAllowedLoss
                                                                        ? 'text-rose-600 dark:text-rose-400'
                                                                        : 'text-amber-700 dark:text-amber-400'
                                                                }`}
                                                            >
                                                                {summary.lossPercent}%
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 grid grid-cols-2 gap-2 text-[11px]">
                                                        <div className="px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-zinc-900/60">
                                                            <span className="text-stone-500">Phế phẩm cân được:</span>{' '}
                                                            <strong className="text-stone-800 dark:text-zinc-100">
                                                                {fmtNum(summary.recordedScrapKg)} Kg
                                                            </strong>
                                                        </div>
                                                        <div className="px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-zinc-900/60">
                                                            <span className="text-stone-500">Ngót / Hao tự nhiên:</span>{' '}
                                                            <strong className="text-stone-800 dark:text-zinc-100">
                                                                {fmtNum(summary.unaccountedShrinkageKg)} Kg
                                                            </strong>
                                                        </div>
                                                    </div>
                                                    {summary.surplusGainKg > 0 && (
                                                        <div className="mt-1.5 text-[11px] font-bold text-sky-700 dark:text-sky-300">
                                                            * Ghi nhận tăng trọng / dư cân đầu ra: +{fmtNum(summary.surplusGainKg)} Kg
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Thanh tỷ trọng trực quan 100% */}
                                        {summary.netInputKg > 0 && (
                                            <div className="pt-1">
                                                <div className="h-3 w-full rounded-full bg-stone-200 dark:bg-zinc-800 overflow-hidden flex">
                                                    <div
                                                        className="bg-emerald-500 h-full"
                                                        style={{ width: `${Math.min(100, summary.primaryYieldPercent)}%` }}
                                                        title={`Thành phẩm chính: ${summary.primaryYieldPercent}%`}
                                                    />
                                                    <div
                                                        className="bg-purple-500 h-full"
                                                        style={{ width: `${Math.min(100, byproductPctOfNet)}%` }}
                                                        title={`Phụ phẩm thu hồi: ${byproductPctOfNet}%`}
                                                    />
                                                    <div
                                                        className={`${
                                                            summary.isOverAllowedLoss ? 'bg-rose-500' : 'bg-amber-500'
                                                        } h-full`}
                                                        style={{ width: `${Math.min(100, summary.lossPercent)}%` }}
                                                        title={`Tổng hao hụt: ${summary.lossPercent}%`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Cảnh báo nổi bật nếu vượt định mức hao hụt */}
                                    {summary.isOverAllowedLoss && (
                                        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 flex items-start gap-3">
                                            <AlertTriangle size={22} className="text-rose-600 shrink-0 mt-0.5" />
                                            <div className="text-xs text-rose-900 dark:text-rose-200 space-y-1">
                                                <div className="font-black text-sm">
                                                    CẢNH BÁO: Tỷ lệ hao hụt thực tế ({summary.lossPercent}%) vượt định mức cho phép ({allowedLossInput}%) là +{summary.lossVariancePercent}%!
                                                </div>
                                                <p>
                                                    Theo quy chế kiểm soát nội bộ, Bộ phận Sản xuất / Kế toán <strong>bắt buộc phải ghi rõ nguyên nhân vượt định mức hao hụt</strong> tại ô Giải trình bên dưới trước khi bấm Chốt Quyết Toán.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. BẢNG CHỈ SỐ THỜI GIAN & GIÁ THÀNH KẾ TOÁN */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Khối Thời gian & Năng suất */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-4 space-y-3">
                                            <h4 className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-zinc-300 flex items-center gap-1.5">
                                                <Clock size={14} className="text-orange-500" />
                                                Chỉ số Thời gian chạy & Năng suất lao động
                                            </h4>
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-zinc-800">
                                                    <span className="text-stone-500">Thời điểm bắt đầu thực tế:</span>
                                                    <span className="font-bold">{fmtDateTime(plan.actual_start_at)}</span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-zinc-800">
                                                    <span className="text-stone-500">Thời điểm kết thúc:</span>
                                                    <span className="font-bold">
                                                        {plan.actual_end_at
                                                            ? fmtDateTime(plan.actual_end_at)
                                                            : 'Đang chạy / Chờ chốt'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-zinc-800">
                                                    <span className="text-stone-500">Tổng thời gian thực chạy:</span>
                                                    <span className="font-black text-stone-900 dark:text-zinc-100">
                                                        {formatDurationMinutes(summary.activeDurationMinutes)} (Nghỉ{' '}
                                                        {pausedMinutesInput || 0}p)
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1 border-b border-stone-100 dark:border-zinc-800">
                                                    <span className="text-stone-500">Năng suất chạy chuyền:</span>
                                                    <span className="font-black text-blue-700 dark:text-blue-400">
                                                        {fmtNum(summary.throughputInputKgPerHour)} Kg NL / giờ
                                                    </span>
                                                </div>
                                                <div className="flex justify-between py-1">
                                                    <span className="text-stone-500">Năng suất bình quân đầu người:</span>
                                                    <span className="font-black text-emerald-700 dark:text-emerald-400">
                                                        {summary.workerProductivityKgPerHour !== null
                                                            ? `${fmtNum(summary.workerProductivityKgPerHour)} Kg / người / giờ`
                                                            : 'Chưa nhập số nhân công'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Khối Kế toán Giá thành */}
                                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-xs font-black uppercase tracking-wider text-stone-600 dark:text-zinc-300 flex items-center gap-1.5">
                                                    <Calculator size={14} className="text-emerald-600" />
                                                    Kế toán Giá vốn Nguyên liệu & Thành phẩm
                                                </h4>
                                                {!isLocked && !isSanxuatPortal && (
                                                    <button
                                                        type="button"
                                                        disabled={savingCosts}
                                                        onClick={handleSaveInputCosts}
                                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-800 text-white hover:bg-stone-900 dark:bg-zinc-700 cursor-pointer"
                                                    >
                                                        {savingCosts ? 'Đang lưu...' : 'Lưu đơn giá / định mức'}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between gap-2 text-xs bg-stone-50 dark:bg-zinc-800/60 px-3 py-2 rounded-xl">
                                                <span className="font-semibold text-stone-600 dark:text-zinc-300">
                                                    Định mức hao hụt cho phép (%):
                                                </span>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min={0}
                                                    max={100}
                                                    disabled={isLocked || isSanxuatPortal}
                                                    value={allowedLossInput}
                                                    onChange={e => setAllowedLossInput(e.target.value)}
                                                    className="w-20 px-2 py-1 text-right font-black rounded-lg bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700"
                                                />
                                            </div>

                                            {inputs.length > 0 && !isSanxuatPortal && (
                                                <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                                                    {inputs.map(inp => (
                                                        <div
                                                            key={inp.id}
                                                            className="flex items-center justify-between gap-2 text-xs"
                                                        >
                                                            <span className="truncate text-stone-600 dark:text-zinc-400">
                                                                Đơn giá {inp.products?.name || 'NL'} (đ/{inp.unit}):
                                                            </span>
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                disabled={isLocked}
                                                                value={editingInputCosts[inp.id] ?? '0'}
                                                                onChange={e =>
                                                                    setEditingInputCosts(prev => ({
                                                                        ...prev,
                                                                        [inp.id]: e.target.value
                                                                    }))
                                                                }
                                                                className="w-28 px-2 py-1 text-right font-bold rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 space-y-1.5 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-stone-500">Tổng giá trị vốn NL tiêu hao ròng:</span>
                                                    <span className="font-black text-stone-900 dark:text-zinc-100">
                                                        {fmtNum(Math.round(summary.totalInputMaterialCost), 0)} VNĐ
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-baseline p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
                                                    <span className="font-bold text-amber-900 dark:text-amber-200">
                                                        Giá vốn NL ước tính / 1 Kg TP chính:
                                                    </span>
                                                    <span className="text-base font-black text-amber-800 dark:text-amber-300">
                                                        {fmtNum(Math.round(summary.estimatedCostPerPrimaryKg), 0)} đ/Kg
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. GIẢI TRÌNH & NÚT CHỐT QUYẾT TOÁN */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-5 space-y-4 shadow-xs">
                                        <div>
                                            <label className="block text-xs font-black text-stone-800 dark:text-zinc-100 mb-1.5">
                                                Giải trình Quyết toán của Sản xuất / Kế toán{' '}
                                                {summary.isOverAllowedLoss && (
                                                    <span className="text-rose-600">
                                                        (* Bắt buộc nhập lý do vượt định mức hao hụt)
                                                    </span>
                                                )}
                                            </label>
                                            <textarea
                                                rows={3}
                                                disabled={isLocked}
                                                value={settlementNotesInput}
                                                onChange={e => setSettlementNotesInput(e.target.value)}
                                                placeholder={
                                                    summary.isOverAllowedLoss
                                                        ? 'Nhập rõ nguyên nhân vượt định mức hao hụt (VD: Nguyên liệu đầu vào chín mềm tỷ lệ vỏ dày cao hơn bình thường, biên bản QC đính kèm...)'
                                                        : 'Ghi chú nhận xét chất lượng lô hàng, đánh giá thu hồi hoặc hướng xử lý phụ phẩm...'
                                                }
                                                className={`w-full px-3.5 py-2.5 text-xs rounded-xl bg-stone-50 dark:bg-zinc-800/60 border focus:outline-none ${
                                                    summary.isOverAllowedLoss && !settlementNotesInput.trim()
                                                        ? 'border-rose-400 focus:border-rose-600'
                                                        : 'border-stone-200 dark:border-zinc-700 focus:border-orange-500'
                                                }`}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            {plan.status === 'COMPLETED' ? (
                                                <div className="flex items-center justify-between w-full gap-3 flex-wrap">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                        <CheckCircle2 size={18} />
                                                        <span>
                                                            Đã chốt quyết toán lúc {fmtDateTime(plan.settled_at)}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        disabled={submitting}
                                                        onClick={handleReopenPlan}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-zinc-200 border border-stone-300 dark:border-zinc-700 cursor-pointer"
                                                    >
                                                        <Unlock size={14} />
                                                        Mở khóa lại kế hoạch
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-end w-full">
                                                    <button
                                                        type="button"
                                                        disabled={submitting || plan.status === 'CANCELED'}
                                                        onClick={handleSettleAndCompletePlan}
                                                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs sm:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                                                    >
                                                        {submitting ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle2 size={17} />
                                                        )}
                                                        Chốt Kết Thúc & Quyết Toán Kế Hoạch
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. LIÊN KẾT CHỨNG TỪ KẾ TOÁN (PXK / PNK) & XUẤT BÁO CÁO EXCEL */}
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 p-5 space-y-3.5 shadow-xs">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-wider text-stone-700 dark:text-zinc-200">
                                                Chứng từ Kế toán Kho & Biên bản Quyết toán
                                            </h4>
                                            <p className="text-xs text-stone-500 dark:text-zinc-400">
                                                Kết chuyển số liệu thực tiêu hao ròng sang Phiếu Xuất Kho (PXK), Thành phẩm & Phụ phẩm sang Phiếu Nhập Kho (PNK) và xuất Biên bản ký 3 bên
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {!isSanxuatPortal && (
                                                <>
                                                    {/* PXK Kế toán */}
                                                    {plan.outbound_orders?.code ? (
                                                        <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex flex-col justify-between">
                                                            <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                                                Phiếu Xuất Kho Kế Toán (PXK)
                                                            </div>
                                                            <div className="mt-1 font-mono text-sm font-black text-blue-900 dark:text-blue-100">
                                                                {plan.outbound_orders.code}
                                                            </div>
                                                            <div className="text-[10px] text-blue-700/80 dark:text-blue-300 mt-0.5">
                                                                Trạng thái: {plan.outbound_orders.status}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onCreateAccountingOutbound?.(plan, summary)
                                                            }
                                                            disabled={!onCreateAccountingOutbound}
                                                            className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 text-left transition-colors disabled:opacity-50 cursor-pointer flex flex-col justify-between gap-1.5"
                                                        >
                                                            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-black text-xs">
                                                                <FileText size={15} />
                                                                Lập Phiếu Xuất Kho Kế Toán (PXK)
                                                            </div>
                                                            <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                                                                Cho {fmtNum(summary.netInputKg)} Kg nguyên liệu thực tiêu hao ròng
                                                            </div>
                                                        </button>
                                                    )}

                                                    {/* PNK Kế toán */}
                                                    {plan.inbound_orders?.code ? (
                                                        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between">
                                                            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                Phiếu Nhập TP & Phụ Phẩm (PNK)
                                                            </div>
                                                            <div className="mt-1 font-mono text-sm font-black text-emerald-900 dark:text-emerald-100">
                                                                {plan.inbound_orders.code}
                                                            </div>
                                                            <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300 mt-0.5">
                                                                Trạng thái: {plan.inbound_orders.status}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                onCreateAccountingInbound?.(plan, summary)
                                                            }
                                                            disabled={!onCreateAccountingInbound}
                                                            className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 text-left transition-colors disabled:opacity-50 cursor-pointer flex flex-col justify-between gap-1.5"
                                                        >
                                                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-black text-xs">
                                                                <PackageCheck size={15} />
                                                                Lập Phiếu Nhập TP & Phụ Phẩm (PNK)
                                                            </div>
                                                            <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                                                                Cho {fmtNum(summary.totalRecoverableOutputKg)} Kg TP chính & Phụ phẩm
                                                            </div>
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* Nút Xuất Biên bản Quyết toán Excel (luôn hiển thị ở cả cổng SX & cổng Kho) */}
                                            <button
                                                type="button"
                                                disabled={exportingExcel}
                                                onClick={handleExportSettlementExcel}
                                                className={`p-3.5 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50/70 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 text-left transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                                                    isSanxuatPortal ? 'sm:col-span-3' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300 font-black text-xs">
                                                    {exportingExcel ? (
                                                        <Loader2 size={15} className="animate-spin" />
                                                    ) : (
                                                        <Download size={15} />
                                                    )}
                                                    Xuất Biên Bản Quyết Toán Excel (2 Sheet)
                                                </div>
                                                <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                                                    Gồm Cân bằng Vật tư, Hao hụt, Giá vốn & Nhật ký các đợt chạy ký 3 bên
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
