'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
    X,
    Calendar,
    Package,
    Users,
    FileText,
    Printer,
    ChevronDown,
    Landmark,
    Edit2,
    Copy,
    Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/Dialog'
import { formatQuantityFull } from '@/lib/numberUtils'
import { useUnitConversion } from '@/hooks/useUnitConversion'

interface BankOutboundDetailModalProps {
    orderId: string | null
    onClose: () => void
    onEdit?: (orderId: string) => void
    onDuplicate?: (orderId: string) => void
    onDelete?: (orderId: string) => void
}

export default function BankOutboundDetailModal({
    orderId,
    onClose,
    onEdit,
    onDuplicate,
    onDelete
}: BankOutboundDetailModalProps) {
    const [order, setOrder] = useState<any | null>(null)
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [showPrintMenu, setShowPrintMenu] = useState(false)
    const { convertUnit } = useUnitConversion()
    const targetUnit = order?.metadata?.targetUnit

    useEffect(() => {
        if (!orderId) {
            setOrder(null)
            setItems([])
            return
        }

        const targetId = orderId as string
        async function fetchDetails() {
            setLoading(true)
            try {
                const [orderRes, itemsRes]: [any, any] = await Promise.all([
                    (supabase.from('bank_outbound_orders' as any) as any)
                        .select('*, customer:customers(name)')
                        .eq('id', targetId)
                        .single(),
                    (supabase.from('bank_outbound_order_items' as any) as any)
                        .select(`
                            *,
                            products (
                                sku,
                                unit,
                                internal_code,
                                internal_name
                            )
                        `)
                        .eq('order_id', targetId)
                        .order('created_at', { ascending: true })
                ])

                if (orderRes?.data) setOrder(orderRes.data)
                if (itemsRes?.data) setItems(itemsRes.data)
            } catch (err) {
                console.error('Error fetching bank outbound details:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchDetails()
    }, [orderId])

    if (!orderId || !order) return null

    const totalQty = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    const totalAmount = items.reduce((sum, it) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)

    const handlePrint = (type: 'bank' | 'internal' | 'official') => {
        setShowPrintMenu(false)
        window.open(`/print/outbound?id=${orderId}&type=${type}&source=bank`, '_blank')
    }

    return (
        <Dialog open={!!orderId} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-stone-50 dark:bg-zinc-900 border-none shadow-2xl">
                <DialogTitle className="sr-only">Chi tiết phiếu {order.code}</DialogTitle>
                <DialogDescription className="sr-only">Chi tiết phiếu xuất ngân hàng {order.code}</DialogDescription>

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-800 border-b border-stone-100 dark:border-zinc-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400 font-mono">
                            {order.code}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                            Phiếu Ngân Hàng
                        </span>
                        {targetUnit && (
                            <div className="flex items-center gap-1.5 text-xs ml-2">
                                <span className="text-stone-400 font-medium">Quy đổi:</span>
                                <span className="font-bold text-orange-600 px-2 py-0.5 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">{targetUnit}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Info Grid - 2 columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 p-4 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-100 dark:border-zinc-800">
                        {/* Column 1 */}
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase">Khách hàng</label>
                            <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                <Users size={16} className="text-orange-500" />
                                {order.customer?.name || order.customer_name || 'N/A'}
                            </p>
                            {order.customer_address && (
                                <p className="text-sm text-stone-500 mt-1 pl-6">
                                    {order.customer_address}
                                </p>
                            )}
                            {order.customer_phone && (
                                <p className="text-sm text-stone-500 mt-0.5 pl-6">
                                    SĐT: {order.customer_phone}
                                </p>
                            )}
                        </div>

                        {/* Column 2 */}
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase">Kho xuất</label>
                            <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                <Package size={16} className="text-orange-500" />
                                {order.warehouse_name || 'N/A'}
                            </p>
                        </div>

                        {/* Column 1 */}
                        <div>
                            <label className="text-xs font-semibold text-stone-400 uppercase">Ngày tạo</label>
                            <p className="font-medium text-stone-900 dark:text-gray-200 flex items-center gap-2 mt-1">
                                <Calendar size={16} className="text-orange-500" />
                                {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm') : '—'}
                            </p>
                        </div>



                        {/* Description */}
                        <div className="md:col-span-2 border-t border-stone-200 dark:border-zinc-700 pt-4">
                            <label className="text-xs font-semibold text-stone-400 uppercase">Diễn giải</label>
                            <p className="font-medium text-stone-900 dark:text-gray-200 flex items-start gap-2 mt-1">
                                <FileText size={16} className="text-stone-400 mt-0.5" />
                                <span className="italic text-stone-600 dark:text-gray-400">
                                    {order.description || 'Không có ghi chú'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div>
                        <h3 className="font-bold text-stone-900 dark:text-white mb-4 flex items-center gap-2">
                            <span className="w-1 h-6 bg-orange-500 rounded-full"></span>
                            Chi tiết hàng hóa ({items.length})
                        </h3>

                        {loading ? (
                            <div className="py-8 text-center text-gray-500">Đang tải chi tiết...</div>
                        ) : (
                            <div className="border border-gray-200 dark:border-zinc-700 rounded-xl overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-stone-50 dark:bg-zinc-800/50 text-stone-500 font-medium align-top">
                                        <tr>
                                            <th className="px-4 py-3 w-10">#</th>
                                            <th className="px-4 py-3 min-w-[370px]">Sản phẩm</th>
                                            <th className="px-4 py-3 w-32">ĐVT</th>
                                            <th className="px-4 py-3 w-28 text-center">SL Thực xuất</th>
                                            {targetUnit && (
                                                <th className="px-4 py-3 w-32 text-center text-orange-600 font-bold">
                                                    <div>SL Quy đổi</div>
                                                    <div className="text-[10px] font-normal">({targetUnit})</div>
                                                </th>
                                            )}
                                            <th className="px-4 py-3">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                        {items.map((item, index) => {
                                            return (
                                                 <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-zinc-800/30">
                                                     <td className="px-4 py-3 text-stone-400">{index + 1}</td>
                                                     <td className="px-4 py-3 font-medium text-stone-900 dark:text-white">
                                                         <div className="text-[10px] text-stone-500 font-mono mb-0.5">
                                                             {item.products?.sku || '-'}
                                                         </div>
                                                         <div>{item.product_name || item.products?.name || 'N/A'}</div>
                                                     </td>
                                                     <td className="px-4 py-3 text-stone-500">{item.unit || '-'}</td>
                                                     <td className="px-4 py-3 text-center font-bold text-stone-900 dark:text-white">
                                                         {formatQuantityFull(item.quantity)}
                                                     </td>
                                                     {targetUnit && (
                                                         <td className="px-4 py-3 text-center font-bold text-orange-600">
                                                             {(() => {
                                                                 if (!item.quantity || !item.unit) return '-'
                                                                 const result = convertUnit(item.product_id, item.unit, targetUnit, item.quantity, item.products?.unit || null)
                                                                 return formatQuantityFull(result)
                                                             })()}
                                                         </td>
                                                     )}
                                                     <td className="px-4 py-3 text-stone-500">{item.note || '-'}</td>
                                                 </tr>
                                             )
                                        })}
                                    </tbody>
                                    <tfoot className="bg-stone-50 dark:bg-zinc-900/60 font-bold border-t border-stone-200 dark:border-zinc-700 text-xs">
                                        <tr>
                                            <td colSpan={3} className="py-3 px-4 text-stone-700 dark:text-gray-300 text-right">
                                                Tổng Cộng:
                                            </td>
                                            <td className="py-3 px-4 text-center text-stone-900 dark:text-white font-bold">
                                                {formatQuantityFull(totalQty)}
                                            </td>
                                            {targetUnit && (
                                                <td className="py-3 px-4 text-center text-orange-600 font-bold">
                                                    {formatQuantityFull(items.reduce((sum, item) => {
                                                        if (!item.quantity || !item.unit) return sum
                                                        const converted = convertUnit(item.product_id, item.unit, targetUnit, item.quantity, item.products?.unit || null)
                                                        return sum + converted
                                                    }, 0))}
                                                </td>
                                            )}
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="sticky bottom-0 z-10 flex items-center justify-between px-6 py-4 bg-white dark:bg-zinc-800 border-t border-stone-200 dark:border-zinc-700">
                    <div className="flex items-center gap-2">
                        {onDelete && (
                            <button
                                onClick={() => onDelete(order.id)}
                                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium text-sm transition-colors border border-red-200 flex items-center gap-1.5"
                            >
                                <Trash2 size={15} /> Xóa Phiếu
                            </button>
                        )}
                        {onDuplicate && (
                            <button
                                onClick={() => onDuplicate(order.id)}
                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5"
                            >
                                <Copy size={15} /> Nhân Bản
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={() => onEdit(order.id)}
                                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium text-sm transition-colors border border-amber-200 flex items-center gap-1.5"
                            >
                                <Edit2 size={15} /> Chỉnh Sửa
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Print Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowPrintMenu(!showPrintMenu)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-md transition-all active:scale-95"
                            >
                                <Printer size={16} />
                                <span>In Phiếu</span>
                                <ChevronDown size={14} />
                            </button>

                            {showPrintMenu && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowPrintMenu(false)} />
                                    <div className="absolute bottom-full right-0 mb-2 w-64 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden z-30">
                                        <button
                                            onClick={() => handlePrint('bank')}
                                            className="w-full px-4 py-3 text-left hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-start gap-3 text-stone-800 dark:text-white border-b border-stone-100 dark:border-zinc-700"
                                        >
                                            <Landmark size={18} className="text-rose-600 mt-0.5" />
                                            <div>
                                                <div className="font-bold text-sm text-rose-700 dark:text-rose-400">
                                                    Mẫu Ngân Hàng (VietinBank)
                                                </div>
                                                <div className="text-xs text-stone-500">Mẫu A4 ký gửi ngân hàng</div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => handlePrint('internal')}
                                            className="w-full px-4 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-700 flex items-center gap-3 text-stone-700 dark:text-gray-200"
                                        >
                                            <Printer size={16} className="text-blue-500" />
                                            <div className="text-xs font-medium">Phiếu nội bộ (không đơn giá)</div>
                                        </button>
                                        <button
                                            onClick={() => handlePrint('official')}
                                            className="w-full px-4 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-700 flex items-center gap-3 text-stone-700 dark:text-gray-200 border-t border-stone-100 dark:border-zinc-700"
                                        >
                                            <Printer size={16} className="text-orange-500" />
                                            <div className="text-xs font-medium">Mẫu 02-VT Hệ Thống</div>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-medium hover:bg-stone-50 dark:hover:bg-zinc-800 text-sm transition-colors"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
