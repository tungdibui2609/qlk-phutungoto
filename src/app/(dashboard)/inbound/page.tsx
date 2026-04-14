'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { Plus, Search, FileDown, Inbox, Package, Filter, MoreHorizontal, ArrowRight, ExternalLink, Edit2, FileText, FileSpreadsheet } from 'lucide-react'
import InboundOrderModal from '@/components/inventory/inbound/InboundOrderModal'
import InboundOrderDetailModal from './InboundOrderDetailModal'
import { LotInboundBuffer } from '@/components/warehouse/lots/LotInboundBuffer'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import DailyExportModal from '@/components/inventory/shared/DailyExportModal'

export default function InboundPage() {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // Buffer Stats
    const [bufferCount, setBufferCount] = useState(0)
    const [isBufferOpen, setIsBufferOpen] = useState(false)
    const [isExportModalOpen, setIsExportModalOpen] = useState(false)
    const [isAllExportModalOpen, setIsAllExportModalOpen] = useState(false)

    // Helper: Utility Check
    const isUtilityEnabled = (utilityId: string) => {
        if (!currentSystem) return false
        const modules = typeof (currentSystem as any).modules === 'string'
            ? JSON.parse((currentSystem as any).modules)
            : (currentSystem as any).modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes(utilityId)
    }

    useEffect(() => {
        fetchOrders()
        updateBufferCount()
    }, [systemType, currentSystem])

    const updateBufferCount = async () => {
        if (!systemType) return
        const { data } = await supabase
            .from('lots')
            .select('metadata')
            .eq('system_code', systemType)
            .order('created_at', { ascending: false })
            .limit(2000)
            
        const activationDate = (currentSystem?.modules as any)?.activation_dates?.lot_accounting_sync
        let count = 0
        data?.forEach((lot: any) => {
            const metadata = lot.metadata as any
            const history = metadata?.system_history || {}
            
            const rawInbound = history.inbound || []
            const rawSyncInbound = history.accounting_sync?.inbound || []
            
            const inbounds = [
                ...(Array.isArray(rawInbound) ? rawInbound : [rawInbound]),
                ...(Array.isArray(rawSyncInbound) ? rawSyncInbound : [rawSyncInbound])
            ]
            
            inbounds.forEach((inb: any) => {
                if (inb.draft === true) {
                    if (activationDate && inb.date < activationDate) return
                    count++
                }
            })
        })
        setBufferCount(count)
    }

    async function fetchOrders() {
        setLoading(true)
        try {
            let query = supabase
                .from('inbound_orders')
                .select(`
                    *,
                    items:inbound_order_items(note),
                    order_types(name)
                `)
                .eq('system_code', systemType)
                .order('created_at', { ascending: false })
                .range(0, 49);

            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter)
            }

            const { data, error } = await query
            if (error) throw error
            setOrders(data || [])
        } catch (error: any) {
            showToast('Lỗi tải danh sách phiếu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            fetchOrders()
            return
        }
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('inbound_orders')
                .select(`
                    *,
                    items:inbound_order_items(note),
                    order_types(name)
                `)
                .eq('system_code', systemType)
                .or(`code.ilike.%${searchQuery}%,supplier_name.ilike.%${searchQuery}%`)
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setOrders(data || [])
        } catch (e: any) {
            showToast('Lỗi tìm kiếm: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'bg-green-100 text-green-700 border-green-200'
            case 'Pending': return 'bg-amber-100 text-amber-700 border-amber-200'
            case 'Processing': return 'bg-blue-100 text-blue-700 border-blue-200'
            case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200'
            default: return 'bg-gray-100 text-gray-700 border-gray-200'
        }
    }

    const getStatusText = (status: string) => {
        switch (status) {
            case 'Completed': return 'Đã hoàn tất'
            case 'Pending': return 'Chờ duyệt'
            case 'Processing': return 'Đang xử lý'
            case 'Cancelled': return 'Đã hủy'
            default: return status
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Quản lý Nhập kho</h1>
                    <p className="text-gray-500">Xem và quản lý các phiếu nhập kho trong hệ thống</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        className="relative flex items-center h-10 px-4 bg-white border border-amber-200 rounded-lg hover:bg-amber-50 transition-all font-medium text-amber-700"
                        onClick={() => setIsBufferOpen(true)}
                    >
                        <Inbox className="w-4 h-4 mr-2 text-amber-500" />
                        <span>Hàng chờ</span>
                        {bufferCount > 0 && (
                            <span className="absolute -top-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
                                {bufferCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setIsAllExportModalOpen(true)}
                        className="flex items-center gap-2 h-10 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium"
                    >
                        <FileText size={16} />
                        Báo cáo Tổng hợp
                    </button>
                    <button
                        onClick={() => setIsExportModalOpen(true)}
                        className="flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <FileSpreadsheet size={16} />
                        Báo cáo Nhập
                    </button>
                    <button
                        className="flex items-center h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all active:scale-95 font-medium"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Tạo phiếu mới
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    placeholder="Tìm theo mã phiếu, nhà cung cấp..."
                                    className="w-full pl-10 h-10 border border-gray-200 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <select 
                                className="w-full md:w-[180px] h-10 border border-gray-200 rounded-lg px-3 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[right_0.75rem_center]"
                                value={statusFilter} 
                                onChange={(e) => {
                                    setStatusFilter(e.target.value);
                                    setTimeout(() => fetchOrders(), 0);
                                }}
                            >
                                <option value="all">Tất cả trạng thái</option>
                                <option value="Pending">Chờ duyệt</option>
                                <option value="Processing">Đang xử lý</option>
                                <option value="Completed">Đã hoàn tất</option>
                                <option value="Cancelled">Đã hủy</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="bg-white min-h-[400px]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                <p className="text-gray-500">Đang tải danh sách phiếu...</p>
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                                <Inbox className="w-12 h-12 text-gray-200" />
                                <p className="text-gray-500">Không tìm thấy phiếu nào</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/50 border-b">
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Mã phiếu</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Nhà cung cấp</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Ngày tạo</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Người tạo</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {orders.map((order) => (
                                            <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-semibold text-indigo-600 cursor-pointer" onClick={() => { setSelectedOrderId(order.id); setIsDetailModalOpen(true); }}>
                                                            {order.code}
                                                        </span>
                                                        <span className="text-[11px] text-gray-400 mt-0.5">{order.order_types?.name || 'Nhập kho'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-900">{order.supplier_name || 'Hệ thống'}</span>
                                                        <span className="text-xs text-gray-500">Kho: {order.warehouse_name || '---'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-gray-600">
                                                        {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-sm text-gray-600">{order.created_by_name || 'Hệ thống'}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusColor(order.status)} border`}>
                                                        {getStatusText(order.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <button 
                                                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                            onClick={() => { setSelectedOrderId(order.id); setIsDetailModalOpen(true); }}
                                                            title="Xem chi tiết"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </button>
                                                        {order.status !== 'Cancelled' && (
                                                            <button 
                                                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                                onClick={() => { setSelectedOrderId(order.id); setIsCreateModalOpen(true); }}
                                                                title="Sửa phiếu"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="p-4 border-t border-gray-100 bg-gray-50/30">
                           <p className="text-xs text-gray-500 text-center">
                              Hiển thị 50 phiếu mới nhất. Sử dụng tìm kiếm để xem các phiếu cũ hơn.
                           </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-lg">
                                <Inbox className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-indigo-600">Tổng phiếu nhập</p>
                                <h3 className="text-2xl font-bold text-gray-900">{orders.length}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-500 rounded-lg">
                                <ArrowRight className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-amber-600">Phiếu chờ duyệt</p>
                                <h3 className="text-2xl font-bold text-gray-900">
                                    {orders.filter(o => o.status === 'Pending').length}
                                </h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isCreateModalOpen && (
                <InboundOrderModal
                    isOpen={isCreateModalOpen}
                    onClose={() => { setIsCreateModalOpen(false); setSelectedOrderId(null); }}
                    onSuccess={() => {
                        fetchOrders();
                        showToast(`Phiếu nhập ${selectedOrderId ? 'đã cập nhật' : 'đã tạo'} thành công!`, 'success');
                        setSelectedOrderId(null);
                    }}
                    editOrderId={selectedOrderId || undefined}
                    systemCode={systemType}
                />
            )}

            {isDetailModalOpen && selectedOrderId && (
                <InboundOrderDetailModal
                    order={orders.find(o => o.id === selectedOrderId)}
                    onClose={() => { setIsDetailModalOpen(false); setSelectedOrderId(null); }}
                    onUpdate={fetchOrders}
                />
            )}

            {isBufferOpen && (
                <LotInboundBuffer
                    isOpen={isBufferOpen}
                    onClose={() => { setIsBufferOpen(false); updateBufferCount(); }}
                    onSuccess={fetchOrders}
                />
            )}

            <DailyExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                type="inbound"
            />

            <DailyExportModal 
                isOpen={isAllExportModalOpen} 
                onClose={() => setIsAllExportModalOpen(false)} 
                type="all"
            />
        </div>
    )
}
