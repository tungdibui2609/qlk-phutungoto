'use client'

import React, { useState, useEffect } from 'react'
import {
    Plus,
    Search,
    Printer,
    Edit2,
    Trash2,
    Copy,
    RefreshCw,
    Download,
    Calendar,
    Warehouse as WarehouseIcon,
    Building2,
    Landmark,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ExternalLink,
    CheckSquare,
    Square,
    DollarSign,
    Package,
    Inbox,
    Eye,
    MoreHorizontal,
    X
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import BankOutboundOrderModal from '@/components/inventory/bank/BankOutboundOrderModal'
import BankOutboundDetailModal from '@/components/inventory/bank/BankOutboundDetailModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { formatQuantityFull } from '@/lib/numberUtils'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

export default function BankOutboundPage() {
    const { showToast } = useToast()
    const { systemType } = useSystem()

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [branches, setBranches] = useState<any[]>([])

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [warehouseFilter, setWarehouseFilter] = useState('all')

    // Pagination
    const [currentPage, setCurrentPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const PAGE_SIZE = 20

    // Modals & Popovers
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editOrderId, setEditOrderId] = useState<string | null>(null)
    const [duplicateOrderId, setDuplicateOrderId] = useState<string | null>(null)
    const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
    const [previewItemsOrder, setPreviewItemsOrder] = useState<any | null>(null)
    const [actionMenu, setActionMenu] = useState<{ id: string; top?: number; bottom?: number; right: number } | null>(null)

    // Selection
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())

    // Delete confirm
    const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null)

    // Load branches
    useEffect(() => {
        async function fetchBranches() {
            const { data } = await supabase.from('branches').select('id, name').order('name')
            if (data) setBranches(data)
        }
        fetchBranches()
    }, [])

    // Load orders
    useEffect(() => {
        fetchOrders(0)
    }, [systemType])

    async function fetchOrders(page = currentPage) {
        setLoading(true)
        try {
            let countQuery = supabase
                .from('bank_outbound_orders' as any)
                .select('*', { count: 'exact', head: true })

            if (systemType) countQuery = countQuery.eq('system_code', systemType)
            if (warehouseFilter !== 'all') countQuery = countQuery.eq('warehouse_name', warehouseFilter)
            if (startDate) countQuery = countQuery.gte('created_at', new Date(`${startDate}T00:00:00`).toISOString())
            if (endDate) countQuery = countQuery.lte('created_at', new Date(`${endDate}T23:59:59.999`).toISOString())
            if (searchQuery.trim()) {
                countQuery = countQuery.or(`code.ilike.%${searchQuery.trim()}%,customer_name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`)
            }

            const { count } = await countQuery
            const total = count || 0
            setTotalCount(total)

            const from = page * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            let query = supabase
                .from('bank_outbound_orders' as any)
                .select(`
                    *,
                    customer:customers(name),
                    items:bank_outbound_order_items(
                        id,
                        product_name,
                        unit,
                        quantity,
                        price
                    )
                `)
                .order('created_at', { ascending: false })
                .range(from, to)

            if (systemType) query = query.eq('system_code', systemType)
            if (warehouseFilter !== 'all') query = query.eq('warehouse_name', warehouseFilter)
            if (startDate) query = query.gte('created_at', new Date(`${startDate}T00:00:00`).toISOString())
            if (endDate) query = query.lte('created_at', new Date(`${endDate}T23:59:59.999`).toISOString())
            if (searchQuery.trim()) {
                query = query.or(`code.ilike.%${searchQuery.trim()}%,customer_name.ilike.%${searchQuery.trim()}%,description.ilike.%${searchQuery.trim()}%`)
            }

            const { data, error } = await query
            if (error) throw error
            setOrders(data || [])
            setCurrentPage(page)
        } catch (err: any) {
            console.error('Error fetching bank outbound orders:', err)
            showToast('Lỗi tải danh sách phiếu: ' + err.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteOrder = async () => {
        if (!deleteOrderId) return
        try {
            const { error } = await (supabase
                .from('bank_outbound_orders' as any)
                .delete()
                .eq('id', deleteOrderId))
            if (error) throw error
            showToast('Đã xóa phiếu xuất ngân hàng', 'success')
            setDeleteOrderId(null)
            fetchOrders()
        } catch (err: any) {
            showToast('Lỗi khi xóa phiếu: ' + err.message, 'error')
        }
    }

    const handleOrderSuccess = (orderId?: string, autoPrint = false) => {
        fetchOrders()
        if (autoPrint && orderId) {
            window.open(`/print/outbound?id=${orderId}&type=bank&source=bank`, '_blank')
        }
    }

    // Export to Excel
    const handleExportExcel = async () => {
        if (orders.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        try {
            const workbook = new ExcelJS.Workbook()
            const worksheet = workbook.addWorksheet('Danh Sách Phiếu Xuất NH')

            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Mã Phiếu', key: 'code', width: 20 },
                { header: 'Thời Gian Lập', key: 'created_at', width: 20 },
                { header: 'Khách Hàng', key: 'customer', width: 30 },
                { header: 'Kho Hàng', key: 'warehouse', width: 18 },
                { header: 'Số Mặt Hàng', key: 'item_count', width: 14 },
                { header: 'Tổng Số Lượng', key: 'total_qty', width: 16 },
                { header: 'Tổng Tiền (VNĐ)', key: 'total_amount', width: 20 },
                { header: 'Ghi Chú', key: 'description', width: 30 }
            ]

            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' }
            }

            orders.forEach((o, index) => {
                const totalQty = (o.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
                const totalAmount = (o.items || []).reduce((sum: number, it: any) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)

                worksheet.addRow({
                    stt: index + 1,
                    code: o.code,
                    created_at: o.created_at ? format(new Date(o.created_at), 'dd/MM/yyyy HH:mm') : '',
                    customer: o.customer?.name || o.customer_name || '',
                    warehouse: o.warehouse_name || '',
                    item_count: o.items?.length || 0,
                    total_qty: totalQty,
                    total_amount: totalAmount,
                    description: o.description || ''
                })
            })

            const buffer = await workbook.xlsx.writeBuffer()
            saveAs(new Blob([buffer]), `Phieu_Xuat_Ngan_Hang_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
            showToast('Đã xuất file Excel thành công', 'success')
        } catch (err: any) {
            showToast('Lỗi khi xuất Excel: ' + err.message, 'error')
        }
    }

    const toggleSelectOrder = (orderId: string) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev)
            if (next.has(orderId)) next.delete(orderId)
            else next.add(orderId)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (orders.length > 0 && orders.every(o => selectedOrderIds.has(o.id))) {
            setSelectedOrderIds(new Set())
        } else {
            setSelectedOrderIds(new Set(orders.map(o => o.id)))
        }
    }

    // Stats calculations
    const totalOrderQty = orders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((iSum: number, it: any) => iSum + (Number(it.quantity) || 0), 0)
    }, 0)

    const totalOrderAmount = orders.reduce((sum, o) => {
        return sum + (o.items || []).reduce((iSum: number, it: any) => iSum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)
    }, 0)

    return (
        <div className="p-6 space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                        <Landmark className="w-6 h-6 text-blue-600" />
                        <span>Quản lý Xuất Ngân Hàng</span>
                        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
                            In Ấn & Ký Tá
                        </span>
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Lập và quản lý các phiếu xuất riêng cho ngân hàng (hoàn toàn không ảnh hưởng đến tồn kho thực tế)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-xs"
                    >
                        <FileSpreadsheet size={16} />
                        Báo cáo Xuất NH
                    </button>
                    <button
                        className="flex items-center h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md transition-all active:scale-95 font-medium text-xs"
                        onClick={() => {
                            setEditOrderId(null)
                            setDuplicateOrderId(null)
                            setIsCreateModalOpen(true)
                        }}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Tạo phiếu mới
                    </button>
                </div>
            </div>

            {/* Grid 3:1 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Left: Orders Table */}
                <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Filter bar */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    placeholder="Tìm theo mã phiếu, ghi chú..."
                                    className="w-full pl-9 h-10 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-xs"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchOrders(0)}
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="date"
                                        className="h-10 border border-gray-200 rounded-lg px-2.5 outline-none focus:border-blue-500 w-[130px] text-xs text-gray-600"
                                        value={startDate}
                                        onChange={(e) => {
                                            setStartDate(e.target.value)
                                            setCurrentPage(0)
                                        }}
                                        title="Từ ngày"
                                    />
                                    <span className="text-gray-400">-</span>
                                    <input
                                        type="date"
                                        className="h-10 border border-gray-200 rounded-lg px-2.5 outline-none focus:border-blue-500 w-[130px] text-xs text-gray-600"
                                        value={endDate}
                                        onChange={(e) => {
                                            setEndDate(e.target.value)
                                            setCurrentPage(0)
                                        }}
                                        title="Đến ngày"
                                    />
                                </div>
                                <select
                                    className="h-10 border border-gray-200 rounded-lg px-3 outline-none focus:border-blue-500 text-xs text-gray-700 bg-white"
                                    value={warehouseFilter}
                                    onChange={(e) => {
                                        setWarehouseFilter(e.target.value)
                                        setCurrentPage(0)
                                    }}
                                >
                                    <option value="all">Tất cả kho hàng</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => fetchOrders(0)}
                                    className="h-10 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    Lọc
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white min-h-[420px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                <p className="text-gray-500 text-xs">Đang tải danh sách phiếu...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                                <Inbox className="w-12 h-12 text-gray-200" />
                                <p className="text-gray-500 text-xs">Không tìm thấy phiếu nào</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/70 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
                                            <th className="w-10 px-3 py-3 text-center">
                                                <button onClick={toggleSelectAll} className="flex items-center justify-center w-full hover:text-blue-600 transition-colors">
                                                    {orders.length > 0 && orders.every(o => selectedOrderIds.has(o.id)) ? (
                                                        <CheckSquare className="w-4 h-4 text-blue-600" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-3 py-3 whitespace-nowrap">Mã Phiếu</th>
                                            <th className="px-3 py-3 whitespace-nowrap">Ngày Lập</th>
                                            <th className="px-3 py-3 whitespace-nowrap">Hàng Hóa</th>
                                            <th className="px-3 py-3 whitespace-nowrap text-center">Trạng Thái</th>
                                            <th className="px-3 py-3 whitespace-nowrap text-right">Thao Tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 text-xs">
                                        {orders.map((order, index) => {
                                             const items = order.items || []
                                             const orderQty = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)
                                             const orderAmount = items.reduce((sum: number, it: any) => sum + ((Number(it.quantity) || 0) * (Number(it.price) || 0)), 0)

                                             return (
                                                 <tr
                                                     key={order.id}
                                                     className="hover:bg-blue-50/30 dark:hover:bg-zinc-800/50 transition-colors group"
                                                 >
                                                     {/* Checkbox */}
                                                     <td className="px-3 py-3.5 text-center">
                                                         <button
                                                             onClick={() => toggleSelectOrder(order.id)}
                                                             className="flex items-center justify-center w-full hover:text-blue-600 cursor-pointer transition-colors"
                                                         >
                                                             {selectedOrderIds.has(order.id) ? (
                                                                <CheckSquare className="w-4 h-4 text-blue-600" />
                                                             ) : (
                                                                <Square className="w-4 h-4 text-gray-400" />
                                                             )}
                                                         </button>
                                                     </td>

                                                     {/* Code */}
                                                     <td className="px-3 py-3.5 whitespace-nowrap">
                                                         <div className="flex flex-col">
                                                             <div className="flex items-center gap-1.5">
                                                                <span
                                                                    className="font-bold text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-mono"
                                                                    onClick={() => setDetailOrderId(order.id)}
                                                                >
                                                                    {order.code}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                                    NH
                                                                </span>
                                                            </div>
                                                            {order.warehouse_name && (
                                                                <span className="text-[10px] text-stone-400">
                                                                    Kho: {order.warehouse_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Created Date */}
                                                    <td className="px-3 py-3.5 whitespace-nowrap text-stone-600">
                                                        {order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: vi }) : '---'}
                                                    </td>

                                                    {/* Items Button */}
                                                    <td className="px-3 py-3.5 whitespace-nowrap">
                                                        <button
                                                            onClick={() => setPreviewItemsOrder(order)}
                                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
                                                            title="Bấm để xem danh sách mặt hàng"
                                                        >
                                                            <Package size={13} />
                                                            <span>{items.length} mặt hàng</span>
                                                            <span className="text-[11px] text-blue-600">({formatQuantityFull(orderQty)})</span>
                                                        </button>
                                                    </td>

                                                    {/* Status Badge */}
                                                    <td className="px-3 py-3.5 whitespace-nowrap text-center">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            Hoàn tất
                                                        </span>
                                                    </td>

                                                    {/* Compact Actions: Quick Print + Dropdown */}
                                                    <td className="px-3 py-3.5 whitespace-nowrap text-right">
                                                        <div className="inline-flex items-center justify-end gap-1">
                                                            {/* Quick Print Button */}
                                                            <button
                                                                onClick={() => window.open(`/print/outbound?id=${order.id}&type=bank&source=bank`, '_blank')}
                                                                className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                                title="In chứng từ VietinBank"
                                                            >
                                                                <Printer size={15} />
                                                            </button>

                                                            {/* More Actions Toggle */}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    if (actionMenu?.id === order.id) {
                                                                        setActionMenu(null)
                                                                    } else {
                                                                        const rect = e.currentTarget.getBoundingClientRect()
                                                                        const spaceBelow = window.innerHeight - rect.bottom
                                                                        const spaceAbove = rect.top
                                                                        const openUp = spaceBelow < 155 && spaceAbove > spaceBelow
                                                                        setActionMenu({
                                                                            id: order.id,
                                                                            top: openUp ? undefined : rect.bottom + 4,
                                                                            bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
                                                                            right: Math.max(8, window.innerWidth - rect.right)
                                                                        })
                                                                    }
                                                                }}
                                                                className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                                                title="Thao tác khác"
                                                            >
                                                                <MoreHorizontal size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Fixed Action Menu Dropdown */}
                        {actionMenu && (
                            <>
                                <div
                                    className="fixed z-50 w-36 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-stone-200 dark:border-zinc-700 py-1 text-left animate-in fade-in zoom-in-95 duration-100"
                                    style={{
                                        ...(actionMenu.top !== undefined ? { top: `${actionMenu.top}px` } : {}),
                                        ...(actionMenu.bottom !== undefined ? { bottom: `${actionMenu.bottom}px` } : {}),
                                        right: `${actionMenu.right}px`
                                    }}
                                >
                                    <button
                                        onClick={() => {
                                            const id = actionMenu.id
                                            setActionMenu(null)
                                            setDetailOrderId(id)
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                        <Eye size={13} className="text-blue-600" />
                                        <span>Xem chi tiết</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const id = actionMenu.id
                                            setActionMenu(null)
                                            setEditOrderId(id)
                                            setIsCreateModalOpen(true)
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                        <Edit2 size={13} className="text-amber-600" />
                                        <span>Sửa phiếu</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const id = actionMenu.id
                                            setActionMenu(null)
                                            setDuplicateOrderId(id)
                                            setEditOrderId(null)
                                            setIsCreateModalOpen(true)
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                        <Copy size={13} className="text-purple-600" />
                                        <span>Nhân bản</span>
                                    </button>
                                    <div className="my-1 border-t border-stone-100 dark:border-zinc-700" />
                                    <button
                                        onClick={() => {
                                            const id = actionMenu.id
                                            setActionMenu(null)
                                            setDeleteOrderId(id)
                                        }}
                                        className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={13} />
                                        <span>Xóa phiếu</span>
                                    </button>
                                </div>
                                <div
                                    className="fixed inset-0 z-40 bg-transparent cursor-default"
                                    onClick={() => setActionMenu(null)}
                                />
                            </>
                        )}

                        {/* Modal Quick Preview Items */}
                        {previewItemsOrder && (
                            <div
                                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
                                onClick={() => setPreviewItemsOrder(null)}
                            >
                                <div
                                    className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-stone-200 dark:border-zinc-700 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="px-5 py-3.5 border-b border-stone-100 dark:border-zinc-700 flex items-center justify-between bg-stone-50/70 dark:bg-zinc-800/70">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                                                    Danh sách mặt hàng - {previewItemsOrder.code}
                                                </h3>
                                                <p className="text-[11px] text-stone-500">
                                                    Kho: {previewItemsOrder.warehouse_name || 'Mặc định'} • {previewItemsOrder.items?.length || 0} mặt hàng
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setPreviewItemsOrder(null)}
                                            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="p-4 max-h-[55vh] overflow-y-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-stone-100 dark:border-zinc-700 text-stone-500 text-[11px] font-semibold uppercase">
                                                    <th className="pb-2 text-left">Tên hàng hóa</th>
                                                    <th className="pb-2 text-right">Số lượng</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                                                {(previewItemsOrder.items || []).map((it: any, idx: number) => (
                                                    <tr key={idx} className="hover:bg-stone-50/50 dark:hover:bg-zinc-700/30">
                                                        <td className="py-2.5 font-medium text-stone-800 dark:text-stone-200">
                                                            {it.product_name}
                                                        </td>
                                                        <td className="py-2.5 text-right font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                                                            {formatQuantityFull(it.quantity)} {it.unit || ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-3 border-t border-stone-100 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                                        <span className="text-xs text-stone-500">
                                            Tổng số lượng: <strong className="text-stone-800 dark:text-stone-200">{(previewItemsOrder.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0)}</strong>
                                        </span>
                                        <button
                                            onClick={() => setPreviewItemsOrder(null)}
                                            className="px-4 py-1.5 text-xs font-semibold bg-stone-100 hover:bg-stone-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-stone-700 dark:text-stone-200 rounded-lg transition-colors cursor-pointer"
                                        >
                                            Đóng
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pagination */}
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-500">
                            <p>
                                {totalCount > 0
                                    ? `Hiển thị ${currentPage * PAGE_SIZE + 1} - ${Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} trên ${totalCount} phiếu`
                                    : 'Không có phiếu nào'}
                            </p>
                            {totalCount > PAGE_SIZE && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setCurrentPage(0); fetchOrders(0); }}
                                        disabled={currentPage === 0}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                        title="Trang đầu"
                                    >
                                        <ChevronsLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { const p = Math.max(0, currentPage - 1); setCurrentPage(p); fetchOrders(p); }}
                                        disabled={currentPage === 0}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                        title="Trang trước"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="px-3 py-1 font-medium text-gray-700">
                                        Trang {currentPage + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
                                    </span>
                                    <button
                                        onClick={() => { const p = currentPage + 1; setCurrentPage(p); fetchOrders(p); }}
                                        disabled={(currentPage + 1) * PAGE_SIZE >= totalCount}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                        title="Trang sau"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { const p = Math.ceil(totalCount / PAGE_SIZE) - 1; setCurrentPage(p); fetchOrders(p); }}
                                        disabled={(currentPage + 1) * PAGE_SIZE >= totalCount}
                                        className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                        title="Trang cuối"
                                    >
                                        <ChevronsRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Stat Cards */}
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-blue-600 rounded-lg text-white">
                                <Inbox className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Tổng phiếu xuất NH</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">{totalCount}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-indigo-600 rounded-lg text-white">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Tổng số lượng (trang này)</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                                    {formatQuantityFull(totalOrderQty)}
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-indigo-600 rounded-lg text-white">
                                <Inbox className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Tổng mặt hàng (trang này)</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-0.5">
                                    {orders.reduce((sum, o) => sum + (o.items?.length || 0), 0)}
                                </h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isCreateModalOpen && (
                <BankOutboundOrderModal
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false)
                        setEditOrderId(null)
                        setDuplicateOrderId(null)
                    }}
                    onSuccess={(orderId, autoPrint) => {
                        setIsCreateModalOpen(false)
                        setEditOrderId(null)
                        setDuplicateOrderId(null)
                        handleOrderSuccess(orderId, autoPrint)
                    }}
                    editOrderId={editOrderId}
                    duplicateOrderId={duplicateOrderId}
                    systemCode={systemType}
                />
            )}

            {detailOrderId && (
                <BankOutboundDetailModal
                    orderId={detailOrderId}
                    onClose={() => setDetailOrderId(null)}
                    onEdit={(id) => {
                        setDetailOrderId(null)
                        setEditOrderId(id)
                        setIsCreateModalOpen(true)
                    }}
                    onDuplicate={(id) => {
                        setDetailOrderId(null)
                        setDuplicateOrderId(id)
                        setEditOrderId(null)
                        setIsCreateModalOpen(true)
                    }}
                    onDelete={(id) => {
                        setDetailOrderId(null)
                        setDeleteOrderId(id)
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={!!deleteOrderId}
                title="Xác nhận xóa phiếu"
                message="Bạn có chắc chắn muốn xóa phiếu xuất ngân hàng này không? Dữ liệu sẽ không thể khôi phục."
                onConfirm={handleDeleteOrder}
                onCancel={() => setDeleteOrderId(null)}
                confirmText="Xóa vĩnh viễn"
                variant="danger"
            />
        </div>
    )
}
