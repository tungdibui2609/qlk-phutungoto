'use client'

import React, { useEffect, useState } from 'react'
import { X, Search, ArrowRight, Loader2, CheckCircle2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { useToast } from '@/components/ui/ToastProvider'
import { ConsignmentWarehouse } from './types'
import { fetchTransferredOutboundMap, transferOutboundToConsignment } from './consignmentService'

interface ImportFromOutboundModalProps {
    isOpen: boolean
    warehouses: ConsignmentWarehouse[]
    onClose: () => void
    onSuccess: () => void
}

export default function ImportFromOutboundModal({
    isOpen,
    warehouses,
    onClose,
    onSuccess
}: ImportFromOutboundModalProps) {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    const [orders, setOrders] = useState<any[]>([])
    const [transferredMap, setTransferredMap] = useState<Record<string, { id: string; code: string; warehouseName: string }>>({})
    const [loading, setLoading] = useState(false)
    const [query, setQuery] = useState('')
    const [selectedOrderId, setSelectedOrderId] = useState<string>('')
    const [selectedWhId, setSelectedWhId] = useState<string>('')
    const [submitting, setSubmitting] = useState(false)

    const activeWarehouses = warehouses.filter(w => w.is_active)

    useEffect(() => {
        if (!isOpen || !systemType) return
        setSelectedOrderId('')
        setSelectedWhId(activeWarehouses[0]?.id || '')
        loadOutboundOrders()
    }, [isOpen, systemType])

    async function loadOutboundOrders() {
        setLoading(true)
        const { data } = await (supabase.from('outbound_orders') as any)
            .select('id, code, status, customer_name, warehouse_name, description, created_at, outbound_order_items(id, product_name, quantity, unit)')
            .eq('system_type', systemType)
            .neq('status', 'Cancelled')
            .order('created_at', { ascending: false })
            .limit(80)

        const list = data || []
        setOrders(list)

        const ids = list.map((o: any) => o.id)
        const map = await fetchTransferredOutboundMap(ids, systemType)
        setTransferredMap(map)
        setLoading(false)
    }

    const filteredOrders = orders.filter(o => {
        if (!query.trim()) return true
        const q = query.trim().toLowerCase()
        return (
            String(o.code || '').toLowerCase().includes(q) ||
            String(o.description || '').toLowerCase().includes(q) ||
            String(o.customer_name || '').toLowerCase().includes(q)
        )
    })

    async function handleTransfer() {
        if (!selectedOrderId) {
            showToast('Vui lòng chọn 1 phiếu xuất Kế toán', 'warning')
            return
        }
        if (!selectedWhId) {
            showToast('Vui lòng chọn Kho ký gửi nhận hàng', 'warning')
            return
        }

        setSubmitting(true)
        try {
            const created = await transferOutboundToConsignment({
                outboundOrderId: selectedOrderId,
                systemCode: systemType,
                companyId: profile?.company_id || null,
                consignmentWarehouseId: selectedWhId,
                orderDate: new Date().toISOString(),
                status: 'Completed'
            })
            showToast(`Đã nhận hàng ký gửi ${created.code} thành công!`, 'success')
            onSuccess()
            onClose()
        } catch (err: any) {
            showToast(err.message || 'Lỗi chuyển phiếu', 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-800 w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
                <div className="px-5 py-4 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between bg-amber-50/70 dark:bg-amber-950/20">
                    <div>
                        <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base">
                            Lấy từ Phiếu Xuất Kế Toán gốc
                        </h3>
                        <p className="text-xs text-stone-500">
                            Chọn phiếu xuất hệ thống để tự động tạo Phiếu Nhập vào Kho ký gửi
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-zinc-800"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 border-b border-stone-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Tìm theo mã PXK, diễn giải, đối tác..."
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        />
                    </div>
                    <select
                        value={selectedWhId}
                        onChange={e => setSelectedWhId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-zinc-800 font-medium"
                    >
                        <option value="">-- Chọn Kho ký gửi nhận hàng --</option>
                        {activeWarehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>
                                [{wh.code}] {wh.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {loading ? (
                        <div className="py-12 flex items-center justify-center gap-2 text-sm text-stone-500">
                            <Loader2 size={18} className="animate-spin" /> Đang tải phiếu xuất Kế toán...
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-12 text-center text-sm text-stone-400">
                            Không có phiếu xuất Kế toán phù hợp.
                        </div>
                    ) : (
                        filteredOrders.map(order => {
                            const transferred = transferredMap[order.id]
                            const isSelected = selectedOrderId === order.id
                            const itemCount = order.outbound_order_items?.length || 0
                            return (
                                <button
                                    key={order.id}
                                    type="button"
                                    disabled={Boolean(transferred)}
                                    onClick={() => setSelectedOrderId(order.id)}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                                        transferred
                                            ? 'bg-stone-50 dark:bg-zinc-800/40 border-stone-200 dark:border-zinc-800 opacity-60 cursor-not-allowed'
                                            : isSelected
                                            ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 ring-2 ring-amber-500/20'
                                            : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800 hover:border-amber-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <FileText size={15} className="text-indigo-500" />
                                            <span className="font-bold text-sm text-stone-900 dark:text-stone-100">{order.code}</span>
                                            <span className="text-xs text-stone-500">
                                                • {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300">
                                                {itemCount} mặt hàng
                                            </span>
                                        </div>
                                        {transferred ? (
                                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                Đã chuyển → {transferred.code}
                                            </span>
                                        ) : isSelected ? (
                                            <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                                Đang chọn
                                            </span>
                                        ) : null}
                                    </div>
                                    {(order.description || order.customer_name) && (
                                        <p className="text-xs text-stone-500 mt-1 line-clamp-1">
                                            {order.customer_name ? `[${order.customer_name}] ` : ''}
                                            {order.description || ''}
                                        </p>
                                    )}
                                </button>
                            )
                        })
                    )}
                </div>

                <div className="px-5 py-3.5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium rounded-xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300"
                    >
                        Đóng
                    </button>
                    <button
                        type="button"
                        disabled={submitting || !selectedOrderId || !selectedWhId}
                        onClick={handleTransfer}
                        className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                    >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        Chuyển thành Nhập Ký Gửi
                        <ArrowRight size={15} />
                    </button>
                </div>
            </div>
        </div>
    )
}
