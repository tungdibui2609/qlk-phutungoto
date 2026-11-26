'use client'

import React from 'react'
import {
    Boxes,
    Clock,
    Edit2,
    Trash2,
    Play,
    CheckCircle2,
    AlertTriangle,
    ArrowUpRight,
    Scale,
    Factory,
    User,
    Calendar
} from 'lucide-react'
import { calculatePlanMassBalance, formatDurationMinutes } from '@/lib/productionPlanService'
import {
    PLAN_MODE_CONFIG,
    PLAN_PRIORITY_CONFIG,
    PLAN_STATUS_CONFIG,
    PlanStatus,
    ProductionPlan
} from './types'

export interface PlanCardListProps {
    plans: ProductionPlan[]
    systemNameMap?: Record<string, string>
    showSystemBadge?: boolean
    onSelectPlan: (plan: ProductionPlan) => void
    onOpenStaging: (plan: ProductionPlan) => void
    onEditPlan: (plan: ProductionPlan) => void
    onDeletePlan: (plan: ProductionPlan) => void
    onQuickStatusChange: (plan: ProductionPlan, nextStatus: PlanStatus) => void
}

export default function PlanCardList({
    plans,
    systemNameMap = {},
    showSystemBadge = false,
    onSelectPlan,
    onOpenStaging,
    onEditPlan,
    onDeletePlan,
    onQuickStatusChange
}: PlanCardListProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {plans.map(plan => {
                const inputs = plan.production_plan_inputs || []
                const outputs = plan.production_plan_outputs || []
                const primaryOutputs = outputs.filter(o => o.output_type === 'PRIMARY')
                const logs = plan.production_plan_logs || []
                const summary = calculatePlanMassBalance(plan, inputs, outputs, logs)

                const modeCfg = PLAN_MODE_CONFIG[plan.plan_mode] || PLAN_MODE_CONFIG.INPUT_DRIVEN
                const statusCfg = PLAN_STATUS_CONFIG[plan.status] || PLAN_STATUS_CONFIG.DRAFT
                const priorityCfg = PLAN_PRIORITY_CONFIG[plan.priority] || PLAN_PRIORITY_CONFIG.NORMAL

                const isClosed = plan.status === 'COMPLETED' || plan.status === 'CANCELED'

                return (
                    <div
                        key={plan.id}
                        className="bg-white dark:bg-zinc-900 rounded-[24px] border border-stone-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800/70 transition-all flex flex-col overflow-hidden"
                    >
                        {/* TOP HEADER */}
                        <div className="p-5 pb-3.5 border-b border-stone-100 dark:border-zinc-800/80">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                        <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-lg bg-stone-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                                            {plan.code}
                                        </span>
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusCfg.badgeClass}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                                            {statusCfg.label}
                                        </span>
                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${modeCfg.badgeClass}`}
                                        >
                                            {modeCfg.shortLabel}
                                        </span>
                                        {plan.priority !== 'NORMAL' && (
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${priorityCfg.badgeClass}`}
                                            >
                                                {priorityCfg.label}
                                            </span>
                                        )}
                                        {showSystemBadge && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 border border-stone-200 dark:border-zinc-700">
                                                Kho: {systemNameMap[plan.system_code] || plan.system_code}
                                            </span>
                                        )}
                                    </div>

                                    <h3
                                        onClick={() => onSelectPlan(plan)}
                                        className="text-base font-black text-stone-900 dark:text-zinc-100 hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer line-clamp-1"
                                    >
                                        {plan.name}
                                    </h3>

                                    <div className="mt-1.5 flex items-center gap-3 text-[11px] text-stone-500 dark:text-zinc-400 flex-wrap">
                                        {plan.work_area_name && (
                                            <span className="inline-flex items-center gap-1 font-medium">
                                                <Factory size={12} className="text-stone-400" />
                                                {plan.work_area_name}
                                            </span>
                                        )}
                                        {plan.requested_by_name && (
                                            <span className="inline-flex items-center gap-1">
                                                <User size={12} className="text-stone-400" />
                                                YC: {plan.requested_by_name}
                                            </span>
                                        )}
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar size={12} className="text-stone-400" />
                                            {new Date(plan.created_at).toLocaleDateString('vi-VN')}
                                        </span>
                                        {summary.activeDurationMinutes > 0 && (
                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                                                <Clock size={12} />
                                                Chạy: {formatDurationMinutes(summary.activeDurationMinutes)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!isClosed && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={() => onEditPlan(plan)}
                                            className="p-2 rounded-xl text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                                            title="Chỉnh sửa kế hoạch"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => onDeletePlan(plan)}
                                            className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                            title="Xóa kế hoạch"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* BODY: DUAL PROGRESS (INPUTS & PRIMARY OUTPUTS) */}
                        <div className="p-5 py-4 flex-1 space-y-3.5">
                            {/* Khối Nguyên liệu Đầu vào */}
                            <div className="bg-stone-50/80 dark:bg-zinc-800/40 rounded-2xl p-3 border border-stone-100 dark:border-zinc-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                                        Nguyên liệu Đầu vào lấy từ Tồn kho ({inputs.length})
                                    </span>
                                    <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                        Thực tiêu hao: {summary.netInputKg.toLocaleString('vi-VN')} Kg
                                    </span>
                                </div>

                                {inputs.length === 0 ? (
                                    <p className="text-xs text-stone-400 italic">Chưa khai báo dòng nguyên liệu đầu vào</p>
                                ) : (
                                    <div className="space-y-2">
                                        {inputs.slice(0, 3).map(inp => {
                                            const req = Number(inp.required_quantity) || 0
                                            const alloc = Number(inp.allocated_quantity) || 0
                                            const netIssued = Math.max(
                                                0,
                                                (Number(inp.issued_quantity) || 0) - (Number(inp.returned_quantity) || 0)
                                            )
                                            const pct =
                                                !inp.is_open_quantity && req > 0
                                                    ? Math.min(100, Math.round((netIssued / req) * 100))
                                                    : alloc > 0
                                                      ? Math.min(100, Math.round((netIssued / alloc) * 100))
                                                      : 0

                                            return (
                                                <div key={inp.id} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs gap-2">
                                                        <span className="font-bold text-stone-800 dark:text-zinc-200 truncate">
                                                            {inp.products?.aliases ? (
                                                                <span className="text-orange-600 dark:text-orange-400 mr-1">
                                                                    [{String(inp.products.aliases).split(/[,;\n]/)[0]?.trim()}]
                                                                </span>
                                                            ) : null}
                                                            {inp.products?.name || 'Nguyên liệu'}
                                                        </span>
                                                        <span className="font-mono text-[11px] text-stone-600 dark:text-zinc-300 shrink-0">
                                                            {inp.is_open_quantity ? (
                                                                <>
                                                                    Soạn: <strong>{alloc.toLocaleString('vi-VN')}</strong> • Xuất ròng:{' '}
                                                                    <strong className="text-blue-600 dark:text-blue-400">
                                                                        {netIssued.toLocaleString('vi-VN')} {inp.unit}
                                                                    </strong>{' '}
                                                                    <span className="text-[10px] text-emerald-600">(Mở)</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Soạn: <strong>{alloc.toLocaleString('vi-VN')}</strong> • Rút:{' '}
                                                                    <strong className="text-blue-600 dark:text-blue-400">
                                                                        {netIssued.toLocaleString('vi-VN')}
                                                                    </strong>{' '}
                                                                    / {req.toLocaleString('vi-VN')} {inp.unit} ({pct}%)
                                                                </>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-stone-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-500 rounded-full transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {inputs.length > 3 && (
                                            <p className="text-[11px] text-stone-400 font-semibold">
                                                + {inputs.length - 3} nguyên liệu khác...
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Khối Thành phẩm Mục tiêu Đầu ra */}
                            <div className="bg-emerald-50/40 dark:bg-emerald-950/20 rounded-2xl p-3 border border-emerald-100/80 dark:border-emerald-900/40">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                        Thành phẩm Đầu ra ({primaryOutputs.length})
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                        Thu hồi TP: {summary.primaryOutputKg.toLocaleString('vi-VN')} Kg ({summary.primaryYieldPercent}%)
                                    </span>
                                </div>

                                {primaryOutputs.length === 0 ? (
                                    <p className="text-xs text-stone-400 italic">
                                        Ghi nhận sản lượng thành phẩm trực tiếp khi chạy ca
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {primaryOutputs.slice(0, 2).map(out => {
                                            const target = Number(out.target_quantity) || 0
                                            const prod = Number(out.produced_quantity) || 0
                                            const pct = target > 0 ? Math.min(100, Math.round((prod / target) * 100)) : 0
                                            const doneTarget = target > 0 && prod >= target - 0.0001

                                            return (
                                                <div key={out.id} className="space-y-1">
                                                    <div className="flex items-center justify-between text-xs gap-2">
                                                        <span className="font-bold text-stone-800 dark:text-zinc-200 truncate">
                                                            {out.item_name}
                                                        </span>
                                                        <span className="font-mono text-[11px] shrink-0">
                                                            <strong
                                                                className={
                                                                    doneTarget
                                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                                        : 'text-stone-800 dark:text-zinc-100'
                                                                }
                                                            >
                                                                {prod.toLocaleString('vi-VN')}
                                                            </strong>
                                                            {target > 0 ? ` / ${target.toLocaleString('vi-VN')}` : ''} {out.unit}
                                                            {target > 0 ? ` (${pct}%)` : ''}
                                                        </span>
                                                    </div>
                                                    {target > 0 && (
                                                        <div className="h-1.5 w-full bg-emerald-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all ${
                                                                    doneTarget ? 'bg-emerald-600' : 'bg-emerald-500'
                                                                }`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Thanh chỉ số Cân bằng & Hao hụt tức thời */}
                            <div className="grid grid-cols-3 gap-2 pt-0.5 text-center">
                                <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/60 px-2.5 py-2 border border-stone-100 dark:border-zinc-800">
                                    <p className="text-[10px] text-stone-400 font-bold uppercase">Phụ phẩm thu hồi</p>
                                    <p className="text-xs font-black text-stone-700 dark:text-zinc-200 mt-0.5">
                                        {summary.byproductOutputKg.toLocaleString('vi-VN')} Kg
                                    </p>
                                </div>
                                <div
                                    className={`rounded-xl px-2.5 py-2 border ${
                                        summary.isOverAllowedLoss
                                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                                            : 'bg-stone-50 dark:bg-zinc-800/60 border-stone-100 dark:border-zinc-800'
                                    }`}
                                >
                                    <p className="text-[10px] text-stone-400 font-bold uppercase flex items-center justify-center gap-1">
                                        {summary.isOverAllowedLoss && <AlertTriangle size={11} className="text-rose-500" />}
                                        Hao hụt (ĐM {plan.allowed_loss_percent}%)
                                    </p>
                                    <p
                                        className={`text-xs font-black mt-0.5 ${
                                            summary.isOverAllowedLoss
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-stone-700 dark:text-zinc-200'
                                        }`}
                                    >
                                        {summary.totalLossKg.toLocaleString('vi-VN')} Kg ({summary.lossPercent}%)
                                    </p>
                                </div>
                                <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/60 px-2.5 py-2 border border-stone-100 dark:border-zinc-800">
                                    <p className="text-[10px] text-stone-400 font-bold uppercase">Chứng từ KT</p>
                                    <p className="text-[11px] font-bold text-stone-700 dark:text-zinc-200 mt-0.5 truncate">
                                        {plan.outbound_orders?.code || plan.inbound_orders?.code ? (
                                            <span className="text-emerald-600 dark:text-emerald-400">
                                                {[plan.outbound_orders?.code, plan.inbound_orders?.code]
                                                    .filter(Boolean)
                                                    .join(' • ')}
                                            </span>
                                        ) : (
                                            <span className="text-stone-400">Chưa lập PXK/PNK</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* FOOTER ACTIONS */}
                        <div className="px-5 py-3 bg-stone-50/70 dark:bg-zinc-800/30 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                {plan.status === 'DRAFT' && (
                                    <button
                                        onClick={() => onQuickStatusChange(plan, 'APPROVED')}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition cursor-pointer"
                                    >
                                        <CheckCircle2 size={14} /> Duyệt KH
                                    </button>
                                )}
                                {['APPROVED', 'STAGING', 'PAUSED'].includes(plan.status) && (
                                    <button
                                        onClick={() => onQuickStatusChange(plan, 'IN_PROGRESS')}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition cursor-pointer"
                                    >
                                        <Play size={14} /> Bắt đầu chạy
                                    </button>
                                )}
                                {!isClosed && (
                                    <button
                                        onClick={() => onOpenStaging(plan)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition cursor-pointer"
                                    >
                                        <Boxes size={14} /> Soạn & Giữ LOT ({(plan.production_plan_allocations || []).filter(a => a.status !== 'RELEASED').length})
                                    </button>
                                )}
                            </div>

                            <button
                                onClick={() => onSelectPlan(plan)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-black dark:bg-orange-600 dark:hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                            >
                                <Scale size={14} />
                                <span>{plan.status === 'COMPLETED' ? 'Xem Quyết Toán' : 'Thực thi & Quyết toán'}</span>
                                <ArrowUpRight size={14} />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
