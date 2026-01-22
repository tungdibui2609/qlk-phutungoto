'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Plus, Search, FileText, Calendar, User, Package, ChevronRight, Filter, Edit, Trash2, RotateCcw, StickyNote, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import OutboundOrderModal from './OutboundOrderModal'
import OutboundOrderDetailModal from './OutboundOrderDetailModal'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

type OutboundOrder = Database['public']['Tables']['outbound_orders']['Row'] & {
    items?: { note: string | null }[]
    customer_name?: string | null
    customer_address?: string | null
    customer_phone?: string | null
    warehouse_name?: string | null
    description?: string | null
    image_url?: string | null
    images?: string[] | null
    metadata?: {
        vehicleNumber?: string
        driverName?: string
        containerNumber?: string
    } | null
    order_types?: { name: string } | null
}

export default function OutboundPage() {
    const [orders, setOrders] = useState<OutboundOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<OutboundOrder | null>(null)
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
    const { showToast, showConfirm } = useToast()
    const { systemType } = useSystem()

    useEffect(() => {
        fetchOrders()
    }, [systemType])

    async function fetchOrders() {
        setLoading(true)
        const { data, error } = await supabase
            .from('outbound_orders')
            .select(`
                *,
                items:outbound_order_items(note),
                order_types(name)
            `)
            .eq('system_type', systemType)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching orders:', error)
        } else {
            setOrders((data || []) as any)
        }
        setLoading(false)
    }

    const filteredOrders = orders.filter(order =>
        order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-3">
                        <TrendingUp className="text-orange-600" size={32} />
                        Xuất kho (Kế toán)
                    </h1>
                    <p className="text-stone-500 dark:text-gray-400 mt-1">
                        Quản lý phiếu xuất, lệnh xuất hàng và chứng từ đầu ra.
                    </p>
                </div>
                <button
                    onClick={() => {
                        setEditingOrderId(null)
                        setIsModalOpen(true)
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-lg font-medium shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95"
                >
                    <Plus size={20} />
                    Tạo Phiếu Xuất
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-stone-200 dark:border-zinc-700 p-4 mb-6 sticky top-4 z-20">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo mã phiếu, khách hàng..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 dark:bg-zinc-700 text-stone-700 dark:text-gray-300 rounded-lg hover:bg-stone-200 dark:hover:bg-zinc-600 transition-colors">
                        <Filter size={18} />
                        <span>Bộ lọc</span>
                    </button>
                </div>
            </div>

            {/* Orders List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-xl border border-dashed border-stone-300 dark:border-zinc-700">
                    <Package className="mx-auto text-stone-400 mb-4 opacity-50" size={48} />
                    <p className="text-stone-500 dark:text-gray-400 text-lg font-medium">Chưa có phiếu xuất nào</p>
                    <p className="text-stone-400 text-sm mt-1">Bấm nút "Tạo Phiếu Xuất" để bắt đầu</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {filteredOrders.map(order => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="group bg-white dark:bg-zinc-800 rounded-xl p-5 border border-stone-200 dark:border-zinc-700 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-md transition-all cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {/* Left Info */}
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="font-mono font-bold text-lg text-orange-600 dark:text-orange-400">
                                            {order.code}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${order.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                                            order.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300' :
                                                'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300'
                                            }`}>
                                            {order.status === 'Pending' ? 'Chờ xử lý' : order.status}
                                        </span>
                                    </div>
                                    <h3 className="font-semibold text-stone-900 dark:text-white mb-1">
                                        {order.customer_name || "Khách lẻ"}
                                    </h3>
                                    {order.description && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <FileText size={14} className="text-stone-400" />
                                            <span className="text-sm text-stone-500 dark:text-gray-400 line-clamp-1 italic">
                                                {order.description}
                                            </span>
                                        </div>
                                    )}

                                    {/* Item Notes */}
                                    {order.items && order.items.length > 0 && (
                                        <div className="flex flex-col gap-1 mt-1">
                                            {order.items
                                                .filter((item: any) => item.note)
                                                .slice(0, 3) // Limit to 3 notes
                                                .map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <StickyNote size={14} className="text-amber-500 flex-shrink-0" />
                                                        <span className="text-sm text-stone-500 dark:text-gray-400 line-clamp-1 italic">
                                                            {item.note}
                                                        </span>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>

                                {/* Right Stats & Actions */}
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-6 md:gap-12 text-sm text-stone-600 dark:text-gray-400">
                                        <div className="flex items-center gap-2">
                                            <Package size={16} />
                                            <span>{order.warehouse_name || "Kho mặc định"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Calendar size={16} />
                                            <span>{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        {order.status === 'Completed' && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation()
                                                    const confirmed = await showConfirm(`Bạn có chắc chắn muốn bỏ ghi phiếu ${order.code}? Trạng thái sẽ về Chờ xử lý.`)
                                                    if (!confirmed) return

                                                    try {
                                                        const { error } = await (supabase.from('outbound_orders') as any).update({ status: 'Pending' }).eq('id', order.id)
                                                        if (error) throw error
                                                        showToast('Đã bỏ ghi phiếu thành công', 'success')
                                                        fetchOrders()
                                                    } catch (err: any) {
                                                        showToast(err.message, 'error')
                                                    }
                                                }}
                                                className="p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                                title="Bỏ ghi (Sửa lại)"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        )}

                                        {order.status === 'Pending' && (
                                            <>
                                                {/* Edit Button (Currently not implemented fully in modal, but kept for UI consistency if we want to add edit later) */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        // setEditingOrderId(order.id)
                                                        // setIsModalOpen(true)
                                                        showToast('Tính năng chỉnh sửa đang hoàn thiện', 'info')
                                                    }}
                                                    className="p-2 text-stone-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                                    title="Chỉnh sửa"
                                                >
                                                    <Edit size={18} />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation()
                                                        const confirmed = await showConfirm(`Bạn có chắc chắn muốn xóa phiếu ${order.code}?`)
                                                        if (!confirmed) return

                                                        try {
                                                            const { error } = await supabase.from('outbound_orders').delete().eq('id', order.id)
                                                            if (error) throw error
                                                            showToast('Đã xóa phiếu xuất thành công', 'success')
                                                            fetchOrders()
                                                        } catch (err: any) {
                                                            showToast(err.message, 'error')
                                                        }
                                                    }}
                                                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Xóa phiếu"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </>
                                        )}
                                        <ChevronRight className="text-stone-400 group-hover:text-orange-500 transition-colors ml-2" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Create */}
            <OutboundOrderModal
                key={systemType}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false)
                    setEditingOrderId(null)
                }}
                onSuccess={() => {
                    fetchOrders()
                    setIsModalOpen(false)
                    setEditingOrderId(null)
                }}
                // editOrderId={editingOrderId} // Add edit support to modal later if needed
                systemCode={systemType}
            />

            {/* Modal Detail */}
            <OutboundOrderDetailModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onUpdate={fetchOrders}
            />
        </div>
    )
}
