'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { WorkloadMetrics, LinkedExportOrderSummary, LinkedAccountingOrderSummary, LinkedLotDateSummary, LinkedApprovedAssignmentSummary, formatVNDateSlash } from '../types'

interface ActiveLinkedProofBadgesProps {
    value: WorkloadMetrics
    exportCount: number
    inboundCount: number
    outboundCount: number
    lotSummaryCount: number
    assignmentCount: number
    handleToggleExportOrder: (order: LinkedExportOrderSummary) => void
    handleToggleInboundOrder: (order: LinkedAccountingOrderSummary) => void
    handleToggleOutboundOrder: (order: LinkedAccountingOrderSummary) => void
    handleToggleLotSummary: (summary: LinkedLotDateSummary) => void
    handleToggleApprovedAssignment: (summary: LinkedApprovedAssignmentSummary) => void
}

export function ActiveLinkedProofBadges({
    value,
    exportCount,
    inboundCount,
    outboundCount,
    lotSummaryCount,
    assignmentCount,
    handleToggleExportOrder,
    handleToggleInboundOrder,
    handleToggleOutboundOrder,
    handleToggleLotSummary,
    handleToggleApprovedAssignment,
}: ActiveLinkedProofBadgesProps) {
    return (
        <>
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
        </>
    )
}
