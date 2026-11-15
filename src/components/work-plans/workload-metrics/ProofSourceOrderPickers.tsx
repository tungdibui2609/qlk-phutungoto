'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, Check, Search, Loader2 } from 'lucide-react'
import { WorkloadMetrics, LinkedExportOrderSummary, LinkedAccountingOrderSummary } from '../types'
import type { ProofSourceTab } from './helpers'

interface ProofSourceOrderPickersProps {
    activeSourceTab: ProofSourceTab
    value: WorkloadMetrics
    isStatistics: boolean
    searchExportOrder: string
    setSearchExportOrder: React.Dispatch<React.SetStateAction<string>>
    loadingExportOrders: boolean
    filteredExportOrders: LinkedExportOrderSummary[]
    handleToggleExportOrder: (order: LinkedExportOrderSummary) => void
    searchInbound: string
    setSearchInbound: React.Dispatch<React.SetStateAction<string>>
    loadingInbound: boolean
    filteredInboundOrders: LinkedAccountingOrderSummary[]
    handleToggleInboundOrder: (order: LinkedAccountingOrderSummary) => void
    searchOutbound: string
    setSearchOutbound: React.Dispatch<React.SetStateAction<string>>
    loadingOutbound: boolean
    filteredOutboundOrders: LinkedAccountingOrderSummary[]
    handleToggleOutboundOrder: (order: LinkedAccountingOrderSummary) => void
}

export function ProofSourceOrderPickers({
    activeSourceTab,
    value,
    isStatistics,
    searchExportOrder,
    setSearchExportOrder,
    loadingExportOrders,
    filteredExportOrders,
    handleToggleExportOrder,
    searchInbound,
    setSearchInbound,
    loadingInbound,
    filteredInboundOrders,
    handleToggleInboundOrder,
    searchOutbound,
    setSearchOutbound,
    loadingOutbound,
    filteredOutboundOrders,
    handleToggleOutboundOrder,
}: ProofSourceOrderPickersProps) {
    return (
        <>
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
        </>
    )
}
