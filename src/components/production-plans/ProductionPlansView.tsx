'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Factory,
    Plus,
    RefreshCw,
    FileSpreadsheet,
    Scale,
    Boxes,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Filter
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { ProductSearchInput } from '@/components/shared/ProductSearchInput'
import { matchSearch } from '@/lib/searchUtils'
import OutboundOrderModal from '@/components/inventory/outbound/OutboundOrderModal'
import InboundOrderModal from '@/components/inventory/inbound/InboundOrderModal'
import { calculatePlanMassBalance } from '@/lib/productionPlanService'
import { exportProductionPlansSummaryExcel } from '@/lib/productionPlanExcelExport'
import {
    MassBalanceSummary,
    PLAN_STATUS_CONFIG,
    PlanMode,
    PlanStatus,
    ProductLite,
    ProductionPlan
} from './types'
import { CreateProductionPlanModal } from './CreateProductionPlanModal'
import PlanCardList from './PlanCardList'
import StagingAllocationModal from './StagingAllocationModal'
import { PlanDetailDrawer } from './PlanDetailDrawer'

interface ProductionPlansViewProps {
    isSanxuatPortal?: boolean
}

export default function ProductionPlansView({ isSanxuatPortal = false }: ProductionPlansViewProps) {
    const { showToast, showConfirm } = useToast()
    const { systemType, systems } = useSystem()
    const { profile } = useUser()

    // Ở cổng Sản Xuất (/sanxuat/production-plans), cho phép lọc theo kho nguồn hoặc xem toàn bộ kho của công ty
    const [selectedSystemFilter, setSelectedSystemFilter] = useState<string>(
        isSanxuatPortal ? 'ALL' : systemType
    )

    useEffect(() => {
        if (!isSanxuatPortal) {
            setSelectedSystemFilter(systemType)
        }
    }, [systemType, isSanxuatPortal])

    const [plans, setPlans] = useState<ProductionPlan[]>([])
    const [products, setProducts] = useState<ProductLite[]>([])
    const [loading, setLoading] = useState(true)
    const [exportingSummary, setExportingSummary] = useState(false)

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | PlanStatus>('ACTIVE')
    const [modeFilter, setModeFilter] = useState<'ALL' | PlanMode>('ALL')

    // Modals & Drawers
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null)
    const [stagingPlan, setStagingPlan] = useState<ProductionPlan | null>(null)
    const [activeDetailPlanId, setActiveDetailPlanId] = useState<string | null>(null)

    // Accounting Order Modals (WMS / Kế toán)
    const [accountingOutboundState, setAccountingOutboundState] = useState<{
        isOpen: boolean
        plan: ProductionPlan | null
        initialData: any
    }>({ isOpen: false, plan: null, initialData: null })

    const [accountingInboundState, setAccountingInboundState] = useState<{
        isOpen: boolean
        plan: ProductionPlan | null
        initialData: any
    }>({ isOpen: false, plan: null, initialData: null })

    const systemNameMap = useMemo(() => {
        const map: Record<string, string> = {}
        for (const s of systems || []) {
            map[s.code] = s.name
        }
        return map
    }, [systems])

    const activeSystemForModal = useMemo(() => {
        if (!isSanxuatPortal) return systemType
        if (selectedSystemFilter !== 'ALL') return selectedSystemFilter
        return systems?.[0]?.code || systemType || 'KHO_NGUYEN_VAT_LIEU'
    }, [isSanxuatPortal, selectedSystemFilter, systemType, systems])

    const fetchPlansAndProducts = useCallback(async () => {
        setLoading(true)
        try {
            let planQuery = (supabase.from('production_plans' as any) as any)
                .select(`
                    *,
                    customers(id, name),
                    productions(id, code, name),
                    boms(id, code, name, quantity),
                    outbound_orders(id, code, status),
                    inbound_orders(id, code, status),
                    production_plan_inputs(
                        *,
                        products(id, name, sku, unit, aliases, internal_code, internal_name, weight_kg, cost_price, price, category_id)
                    ),
                    production_plan_outputs(
                        *,
                        products(id, name, sku, unit, aliases, internal_code, internal_name, weight_kg, cost_price, price, category_id)
                    ),
                    production_plan_allocations(
                        *,
                        products(id, name, sku, unit, aliases),
                        export_tasks(id, code, status)
                    ),
                    production_plan_logs(*)
                `)
                .order('created_at', { ascending: false })

            // QUY TẮC CÔ LẬP PHÂN HỆ: Ở cổng Kho WMS bắt buộc lọc cứng system_code = systemType
            if (!isSanxuatPortal) {
                planQuery = planQuery.eq('system_code', systemType)
            } else if (selectedSystemFilter !== 'ALL') {
                planQuery = planQuery.eq('system_code', selectedSystemFilter)
            }

            let prodQuery = supabase
                .from('products')
                .select(
                    'id, name, sku, unit, internal_code, internal_name, aliases, weight_kg, cost_price, price, category_id, system_type, system_code, product_units(unit_id, conversion_rate)'
                )
                .order('name', { ascending: true })

            if (!isSanxuatPortal) {
                prodQuery = prodQuery.or(`system_type.eq.${systemType},system_code.eq.${systemType}`)
            } else if (selectedSystemFilter !== 'ALL') {
                prodQuery = prodQuery.or(
                    `system_type.eq.${selectedSystemFilter},system_code.eq.${selectedSystemFilter}`
                )
            }

            const [plansRes, prodsRes] = await Promise.all([planQuery, prodQuery])
            if (plansRes.error) throw plansRes.error

            setPlans((plansRes.data || []) as ProductionPlan[])
            setProducts((prodsRes.data || []) as ProductLite[])
        } catch (err: any) {
            console.error('Error fetching production plans:', err)
            showToast('Lỗi tải danh sách kế hoạch sản xuất: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }, [isSanxuatPortal, selectedSystemFilter, systemType, showToast])

    useEffect(() => {
        fetchPlansAndProducts()
    }, [fetchPlansAndProducts])

    // Lọc danh sách theo từ khóa (hỗ trợ tên gõ tắt aliases trên cả NVL đầu vào & TP đầu ra), trạng thái & chế độ
    const filteredPlans = useMemo(() => {
        return plans.filter(plan => {
            if (statusFilter === 'ACTIVE') {
                if (plan.status === 'COMPLETED' || plan.status === 'CANCELED') return false
            } else if (statusFilter !== 'ALL') {
                if (plan.status !== statusFilter) return false
            }

            if (modeFilter !== 'ALL' && plan.plan_mode !== modeFilter) return false

            if (searchTerm.trim()) {
                const matchHeader = matchSearch(
                    {
                        code: plan.code,
                        name: plan.name,
                        notes: plan.notes,
                        description: `${plan.work_area_name || ''} ${plan.requested_by_name || ''} ${plan.productions?.code || ''}`
                    },
                    searchTerm
                )
                const matchInputs = (plan.production_plan_inputs || []).some(inp =>
                    matchSearch(inp.products || {}, searchTerm)
                )
                const matchOutputs = (plan.production_plan_outputs || []).some(
                    out => matchSearch(out.products || { name: out.item_name }, searchTerm)
                )
                const matchAllocs = (plan.production_plan_allocations || []).some(alloc =>
                    matchSearch(
                        {
                            code: alloc.lot_code,
                            batch_code: alloc.production_code,
                            name: alloc.position_code
                        },
                        searchTerm
                    )
                )

                if (!matchHeader && !matchInputs && !matchOutputs && !matchAllocs) return false
            }

            return true
        })
    }, [plans, statusFilter, modeFilter, searchTerm])

    // KPIs tổng hợp
    const kpiStats = useMemo(() => {
        let runningCount = 0
        let stagingNeededCount = 0
        let overLossCount = 0
        let totalNetInputKg = 0
        let totalPrimaryOutputKg = 0

        for (const p of plans) {
            if (p.status === 'CANCELED') continue
            if (['IN_PROGRESS', 'PAUSED'].includes(p.status)) runningCount++
            if (['DRAFT', 'APPROVED', 'STAGING'].includes(p.status)) stagingNeededCount++

            const mb = calculatePlanMassBalance(
                p,
                p.production_plan_inputs || [],
                p.production_plan_outputs || [],
                p.production_plan_logs || []
            )
            totalNetInputKg += mb.netInputKg
            totalPrimaryOutputKg += mb.primaryOutputKg
            if (mb.isOverAllowedLoss) overLossCount++
        }

        return {
            runningCount,
            stagingNeededCount,
            completedCount: plans.filter(p => p.status === 'COMPLETED').length,
            overLossCount,
            totalNetInputKg: Math.round(totalNetInputKg * 10) / 10,
            totalPrimaryOutputKg: Math.round(totalPrimaryOutputKg * 10) / 10
        }
    }, [plans])

    const handleQuickStatusChange = async (plan: ProductionPlan, nextStatus: PlanStatus) => {
        try {
            const patch: Record<string, any> = {
                status: nextStatus,
                updated_at: new Date().toISOString()
            }
            if (nextStatus === 'IN_PROGRESS' && !plan.actual_start_at) {
                patch.actual_start_at = new Date().toISOString()
            }
            const { error } = await (supabase.from('production_plans' as any) as any)
                .update(patch)
                .eq('id', plan.id)
            if (error) throw error
            showToast(`Đã chuyển kế hoạch ${plan.code} sang "${PLAN_STATUS_CONFIG[nextStatus].label}"`, 'success')
            fetchPlansAndProducts()
        } catch (err: any) {
            showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error')
        }
    }

    const handleDeletePlan = async (plan: ProductionPlan) => {
        const ok = await showConfirm(
            `Bạn có chắc muốn xóa Kế hoạch "${plan.code} - ${plan.name}"? Toàn bộ phân bổ giữ chỗ và nhật ký của kế hoạch này sẽ bị xóa.`
        )
        if (!ok) return
        try {
            const { error } = await (supabase.from('production_plans' as any) as any)
                .delete()
                .eq('id', plan.id)
            if (error) throw error
            showToast(`Đã xóa kế hoạch ${plan.code}`, 'success')
            if (activeDetailPlanId === plan.id) setActiveDetailPlanId(null)
            fetchPlansAndProducts()
        } catch (err: any) {
            showToast('Lỗi xóa kế hoạch: ' + err.message, 'error')
        }
    }

    const handleExportSummaryExcel = async () => {
        if (filteredPlans.length === 0) {
            showToast('Không có dữ liệu kế hoạch nào để xuất Excel', 'warning')
            return
        }
        setExportingSummary(true)
        try {
            const sysLabel = isSanxuatPortal
                ? selectedSystemFilter === 'ALL'
                    ? 'Tất cả phân hệ kho'
                    : systemNameMap[selectedSystemFilter] || selectedSystemFilter
                : systemNameMap[systemType] || systemType
            await exportProductionPlansSummaryExcel(filteredPlans, sysLabel)
            showToast('Đã xuất báo cáo tổng hợp Kế hoạch SX ra Excel', 'success')
        } catch (err: any) {
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        } finally {
            setExportingSummary(false)
        }
    }

    // Tạo chứng từ PXK Kế toán cho Nguyên liệu thực tiêu hao ròng
    const handleOpenAccountingOutbound = (plan: ProductionPlan, summary: MassBalanceSummary) => {
        const netItems = (plan.production_plan_inputs || [])
            .map(inp => {
                const netQty = Math.max(
                    0,
                    Math.round(((Number(inp.issued_quantity) || 0) - (Number(inp.returned_quantity) || 0)) * 1000) / 1000
                )
                return {
                    id: crypto.randomUUID(),
                    productId: inp.product_id,
                    productName: inp.products?.name || '',
                    unit: inp.unit,
                    quantity: netQty,
                    document_quantity: netQty,
                    price: Number(inp.unit_cost || inp.products?.cost_price || inp.products?.price || 0),
                    note: `Xuất tiêu hao ròng theo KHSX ${plan.code} (Xuất: ${inp.issued_quantity}, Trả dư: ${inp.returned_quantity})`,
                    categoryId: inp.products?.category_id || null
                }
            })
            .filter(i => i.quantity > 0)

        if (netItems.length === 0) {
            showToast('Chưa có số lượng nguyên liệu tiêu hao ròng > 0 để lập Phiếu Xuất Kho Kế toán', 'warning')
            return
        }

        setAccountingOutboundState({
            isOpen: true,
            plan,
            initialData: {
                items: netItems,
                orderTypeName: 'sản xuất',
                description: `[Quyết toán KHSX ${plan.code}] ${plan.name} | Thực tiêu hao: ${summary.netInputKg} Kg | Hao hụt: ${summary.totalLossKg} Kg (${summary.lossPercent}%)`
            }
        })
    }

    // Tạo chứng từ PNK Kế toán cho Thành phẩm chính + Phụ phẩm thu hồi
    const handleOpenAccountingInbound = (plan: ProductionPlan, summary: MassBalanceSummary) => {
        const inboundItems = (plan.production_plan_outputs || [])
            .filter(out => out.output_type !== 'SCRAP' && out.product_id && Number(out.produced_quantity) > 0)
            .map(out => {
                const qty = Math.round(Number(out.produced_quantity) * 1000) / 1000
                const estUnitPrice =
                    out.output_type === 'PRIMARY' && summary.estimatedCostPerPrimaryKg > 0
                        ? Math.round(summary.estimatedCostPerPrimaryKg * (Number(out.weight_per_unit_kg) || 1))
                        : Number(out.products?.cost_price || out.products?.price || 0)
                return {
                    id: crypto.randomUUID(),
                    productId: out.product_id!,
                    productName: out.products?.name || out.item_name,
                    unit: out.unit,
                    quantity: qty,
                    document_quantity: qty,
                    price: estUnitPrice,
                    batch_code: out.target_lot_code || undefined,
                    note:
                        out.output_type === 'PRIMARY'
                            ? `Nhập thành phẩm từ KHSX ${plan.code}`
                            : `Nhập phụ phẩm thu hồi từ KHSX ${plan.code}`,
                    categoryId: out.products?.category_id || null
                }
            })

        if (inboundItems.length === 0) {
            showToast(
                'Chưa có Thành phẩm / Phụ phẩm nào có gắn Mã sản phẩm trong danh mục và sản lượng > 0 để lập PNK Kế toán',
                'warning'
            )
            return
        }

        setAccountingInboundState({
            isOpen: true,
            plan,
            initialData: {
                items: inboundItems,
                orderTypeName: 'sản xuất',
                description: `[Nhập TP từ KHSX ${plan.code}] ${plan.name} | Thu hồi TP: ${summary.primaryOutputKg} Kg (${summary.primaryYieldPercent}%) + Phụ phẩm: ${summary.byproductOutputKg} Kg`
            }
        })
    }

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title={isSanxuatPortal ? 'Kế Hoạch Lấy Hàng & Sản Xuất' : 'Kế Hoạch Sản Xuất & Quyết Toán'}
                subtitle="Production Planning, WMS Staging & Mass Balance Settlement"
                description={
                    isSanxuatPortal
                        ? 'Gửi yêu cầu lấy hàng tồn kho theo khối lượng đầu vào hoặc chạy theo mục tiêu thành phẩm đầu ra, cập nhật sản lượng từng ca và đối chiếu hao hụt.'
                        : 'Tiếp nhận kế hoạch sản xuất, soạn giữ LOT tồn kho theo FIFO, theo dõi xuất-trả nhiều đợt, quản lý thời gian và quyết toán cân bằng vật tư - hao hụt kế toán.'
                }
                icon={Factory}
                actionText="Lập Kế Hoạch Mới"
                onActionClick={() => {
                    setEditingPlan(null)
                    setIsCreateModalOpen(true)
                }}
            />

            {/* KPI CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Chờ duyệt / Đang soạn LOT
                        </p>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                            {kpiStats.stagingNeededCount}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">Kế hoạch cần chuẩn bị tồn kho</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <Boxes size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Đang chạy sản xuất
                        </p>
                        <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                            {kpiStats.runningCount}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                            Đã chốt hoàn thành: <strong>{kpiStats.completedCount}</strong>
                        </p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <Clock size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Tiêu hao ròng / Thu hồi TP
                        </p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                            {kpiStats.totalPrimaryOutputKg.toLocaleString('vi-VN')} /{' '}
                            <span className="text-stone-600 dark:text-zinc-300">
                                {kpiStats.totalNetInputKg.toLocaleString('vi-VN')} Kg
                            </span>
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">Thành phẩm chính / Thực xuất ròng</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <Scale size={22} />
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-stone-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                            Cảnh báo định mức hao hụt
                        </p>
                        <p
                            className={`text-2xl font-black mt-1 ${
                                kpiStats.overLossCount > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                        >
                            {kpiStats.overLossCount}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                            {kpiStats.overLossCount > 0 ? 'Kế hoạch vượt % hao hụt cho phép' : 'Tất cả trong ngưỡng cho phép'}
                        </p>
                    </div>
                    <div
                        className={`p-3 rounded-2xl ${
                            kpiStats.overLossCount > 0
                                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                    >
                        {kpiStats.overLossCount > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                </div>
            </div>

            {/* FILTER BAR */}
            <div className="bg-white dark:bg-zinc-900 rounded-[24px] p-4 border border-stone-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
                    <div className="flex-1 min-w-0">
                        <ProductSearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            products={products}
                            placeholder="Tìm theo mã KHSX, tên kế hoạch, mã LOT hoặc tên viết tắt sản phẩm (VD: ri a, khay...)"
                            theme={isSanxuatPortal ? 'emerald' : 'orange'}
                        />
                    </div>

                    {isSanxuatPortal && systems && systems.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Filter size={15} className="text-stone-400 shrink-0" />
                            <select
                                value={selectedSystemFilter}
                                onChange={e => setSelectedSystemFilter(e.target.value)}
                                className="h-10 px-3 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 focus:outline-none focus:border-emerald-500"
                            >
                                <option value="ALL">Tất cả Kho nguồn</option>
                                {systems.map(s => (
                                    <option key={s.code} value={s.code}>
                                        Kho: {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={modeFilter}
                            onChange={e => setModeFilter(e.target.value as any)}
                            className="h-10 px-3 rounded-xl text-xs font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-zinc-200 focus:outline-none focus:border-orange-400"
                        >
                            <option value="ALL">Mọi chế độ kế hoạch</option>
                            <option value="INPUT_DRIVEN">Theo Khối lượng Đầu vào</option>
                            <option value="OUTPUT_DRIVEN">Theo Mục tiêu Đầu ra</option>
                            <option value="HYBRID">Kết hợp Đầu vào & Đầu ra</option>
                        </select>

                        <button
                            onClick={handleExportSummaryExcel}
                            disabled={exportingSummary}
                            className="h-10 px-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            <FileSpreadsheet size={16} />
                            <span>{exportingSummary ? 'Đang xuất...' : 'Xuất Excel Tổng hợp'}</span>
                        </button>

                        <button
                            onClick={fetchPlansAndProducts}
                            className="h-10 w-10 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-stone-600 dark:text-zinc-300 transition cursor-pointer"
                            title="Làm mới dữ liệu"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin text-orange-600' : ''} />
                        </button>
                    </div>
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {[
                        { id: 'ACTIVE', label: 'Đang mở & Thực hiện' },
                        { id: 'ALL', label: 'Tất cả' },
                        { id: 'DRAFT', label: 'Mới yêu cầu' },
                        { id: 'STAGING', label: 'Đã soạn LOT' },
                        { id: 'IN_PROGRESS', label: 'Đang chạy SX' },
                        { id: 'COMPLETED', label: 'Đã chốt quyết toán' },
                        { id: 'CANCELED', label: 'Đã hủy' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id as any)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                statusFilter === tab.id
                                    ? isSanxuatPortal
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-orange-600 text-white shadow-sm'
                                    : 'bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-700'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT */}
            {loading ? (
                <div className="bg-white dark:bg-zinc-900 rounded-[28px] border border-stone-200 dark:border-zinc-800 p-16 text-center shadow-sm">
                    <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400">
                        Đang tải kế hoạch sản xuất...
                    </p>
                </div>
            ) : filteredPlans.length === 0 ? (
                <div className="space-y-4">
                    <EmptyState
                        icon={Factory}
                        title="Chưa có Kế hoạch Sản xuất nào phù hợp"
                        description="Tạo kế hoạch theo Khối lượng đầu vào (VD: A 5 tấn, C 6 tấn) hoặc theo Mục tiêu thành phẩm đầu ra (VD: đủ 500 thùng khay) để kho soạn LOT và theo dõi quyết toán hao hụt."
                    />
                    <div className="flex justify-center">
                        <button
                            onClick={() => {
                                setEditingPlan(null)
                                setIsCreateModalOpen(true)
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                        >
                            <Plus size={16} /> Lập Kế hoạch Sản xuất đầu tiên
                        </button>
                    </div>
                </div>
            ) : (
                <PlanCardList
                    plans={filteredPlans}
                    systemNameMap={systemNameMap}
                    showSystemBadge={isSanxuatPortal}
                    onSelectPlan={plan => setActiveDetailPlanId(plan.id)}
                    onOpenStaging={plan => setStagingPlan(plan)}
                    onEditPlan={plan => {
                        setEditingPlan(plan)
                        setIsCreateModalOpen(true)
                    }}
                    onDeletePlan={handleDeletePlan}
                    onQuickStatusChange={handleQuickStatusChange}
                />
            )}

            {/* MODAL TẠO / SỬA KẾ HOẠCH */}
            <CreateProductionPlanModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false)
                    setEditingPlan(null)
                }}
                onSuccess={newPlanId => {
                    setIsCreateModalOpen(false)
                    setEditingPlan(null)
                    fetchPlansAndProducts()
                    if (newPlanId && !editingPlan) {
                        setActiveDetailPlanId(newPlanId)
                    }
                }}
                systemCode={editingPlan?.system_code || activeSystemForModal}
                allowSelectSystem={isSanxuatPortal && !editingPlan}
                availableSystems={(systems || []).map(s => ({ code: s.code, name: s.name }))}
                editPlan={editingPlan}
                defaultRequestedBy={profile?.full_name || ''}
            />

            {/* MODAL SOẠN HÀNG & GIỮ CHỖ LOT THEO FIFO */}
            <StagingAllocationModal
                isOpen={!!stagingPlan}
                onClose={() => setStagingPlan(null)}
                plan={stagingPlan}
                onUpdated={() => {
                    fetchPlansAndProducts()
                }}
            />

            {/* DRAWER THỰC THI CA & QUYẾT TOÁN HAO HỤT / GIÁ THÀNH */}
            <PlanDetailDrawer
                isOpen={!!activeDetailPlanId}
                onClose={() => setActiveDetailPlanId(null)}
                planId={activeDetailPlanId}
                systemCode={systemType}
                products={products}
                isSanxuatPortal={isSanxuatPortal}
                onPlanChanged={fetchPlansAndProducts}
                onOpenStaging={plan => setStagingPlan(plan)}
                onCreateAccountingOutbound={handleOpenAccountingOutbound}
                onCreateAccountingInbound={handleOpenAccountingInbound}
            />

            {/* TÍCH HỢP PHIẾU XUẤT KHO KẾ TOÁN (PXK) */}
            {accountingOutboundState.isOpen && accountingOutboundState.plan && (
                <OutboundOrderModal
                    isOpen={accountingOutboundState.isOpen}
                    onClose={() => setAccountingOutboundState({ isOpen: false, plan: null, initialData: null })}
                    systemCode={accountingOutboundState.plan.system_code}
                    initialData={accountingOutboundState.initialData}
                    onSuccess={async createdOrderId => {
                        if (createdOrderId && accountingOutboundState.plan) {
                            await (supabase.from('production_plans' as any) as any)
                                .update({
                                    outbound_order_id: createdOrderId,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', accountingOutboundState.plan.id)
                        }
                        setAccountingOutboundState({ isOpen: false, plan: null, initialData: null })
                        showToast('Đã tạo và liên kết Phiếu Xuất Kho Kế toán thành công!', 'success')
                        fetchPlansAndProducts()
                    }}
                />
            )}

            {/* TÍCH HỢP PHIẾU NHẬP KHO KẾ TOÁN (PNK THÀNH PHẨM & PHỤ PHẨM) */}
            {accountingInboundState.isOpen && accountingInboundState.plan && (
                <InboundOrderModal
                    isOpen={accountingInboundState.isOpen}
                    onClose={() => setAccountingInboundState({ isOpen: false, plan: null, initialData: null })}
                    systemCode={accountingInboundState.plan.system_code}
                    initialData={accountingInboundState.initialData}
                    onSuccess={async createdOrderId => {
                        if (createdOrderId && accountingInboundState.plan) {
                            await (supabase.from('production_plans' as any) as any)
                                .update({
                                    inbound_order_id: createdOrderId,
                                    updated_at: new Date().toISOString()
                                })
                                .eq('id', accountingInboundState.plan.id)
                        }
                        setAccountingInboundState({ isOpen: false, plan: null, initialData: null })
                        showToast('Đã tạo và liên kết Phiếu Nhập Kho Thành phẩm thành công!', 'success')
                        fetchPlansAndProducts()
                    }}
                />
            )}
        </div>
    )
}
