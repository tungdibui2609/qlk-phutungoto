'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { Plus, Search, FileDown, Inbox, Package, Filter, MoreHorizontal, ArrowRight, ExternalLink, Edit2, Trash2, RotateCcw, FileText, FileSpreadsheet, CheckSquare, Square, Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Printer, Eye, X, ChevronDown } from 'lucide-react'
import InboundOrderModal from '@/components/inventory/inbound/InboundOrderModal'
import InboundOrderDetailModal from './InboundOrderDetailModal'
import { LotInboundBuffer } from '@/components/warehouse/lots/LotInboundBuffer'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import DailyExportModal from '@/components/inventory/shared/DailyExportModal'
import { getOrderTypeBadgeColor } from '@/lib/orderTypeUtils'

export default function InboundPage() {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchType, setSearchType] = useState<'all' | 'product' | 'description' | 'code' | 'partner'>('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [orderTypeFilter, setOrderTypeFilter] = useState('all')
    const [orderTypes, setOrderTypes] = useState<any[]>([])
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [currentPage, setCurrentPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const PAGE_SIZE = 20
    const [actionMenu, setActionMenu] = useState<{ id: string; top?: number; bottom?: number; right: number } | null>(null)

    useEffect(() => {
        const handleScroll = () => {
            if (actionMenu) setActionMenu(null)
        }
        window.addEventListener('scroll', handleScroll, true)
        return () => window.removeEventListener('scroll', handleScroll, true)
    }, [actionMenu])

    // Helper to get order type name accurately
    const getOrderTypeName = (order: any) => {
        const rawName = Array.isArray(order.order_types) ? order.order_types[0]?.name : order.order_types?.name;
        if (rawName) return rawName;

        if (order.order_type_id && orderTypes.length > 0) {
            const found = orderTypes.find((t: any) => t.id === order.order_type_id);
            if (found) return found.name;
        }

        const desc = (order.description || '').toLowerCase();
        const meta = order.metadata || {};
        const rawType = (order.type || '').toLowerCase();

        if (desc.includes('điều chỉnh') || desc.includes('kiểm kê') || meta.is_adjustment || rawType.includes('adjust')) {
            return 'Điều Chỉnh';
        }
        if (desc.includes('sản xuất') || desc.includes('lệnh sx') || meta.production_order_id || meta.production_order_code || meta.production_lot || meta.source === 'production' || rawType.includes('product')) {
            return 'Sản Xuất';
        }
        if (desc.includes('phân loại') || desc.includes('rework') || rawType.includes('classif')) {
            return 'Phân Loại';
        }
        if (desc.includes('chuyển đổi') || desc.includes('unbundle') || rawType.includes('conver') || order.code?.includes('-AUTO')) {
            return 'Chuyển Đổi';
        }
        if (desc.includes('nhập trả') || desc.includes('trả hàng') || rawType.includes('return')) {
            return 'Nhập Trả';
        }
        if (desc.includes('mượn') || desc.includes('nội bộ') || rawType.includes('internal')) {
            return 'Xuất Mượn/Dùng';
        }
        return 'Nhập Mới';
    }

    // Buffer Stats
    const [bufferCount, setBufferCount] = useState(0)
    const [isBufferOpen, setIsBufferOpen] = useState(false)
    const [isExportModalOpen, setIsExportModalOpen] = useState(false)
    const [isAllExportModalOpen, setIsAllExportModalOpen] = useState(false)

    // Batch download state
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set())
    const [isBatchDownloading, setIsBatchDownloading] = useState(false)
    const [previewItemsOrder, setPreviewItemsOrder] = useState<any | null>(null)
    const [duplicateOrderId, setDuplicateOrderId] = useState<string | null>(null)

    // Helper: Utility Check
    const isUtilityEnabled = (utilityId: string) => {
        if (!currentSystem) return false
        const modules = typeof (currentSystem as any).modules === 'string'
            ? JSON.parse((currentSystem as any).modules)
            : (currentSystem as any).modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes(utilityId)
    }

    useEffect(() => {
        async function loadOrderTypes() {
            if (!systemType) return
            const { data } = await (supabase.from('order_types') as any)
                .select('*')
                .or('scope.eq.inbound,scope.eq.both')
                .or(`system_code.eq.${systemType},system_code.is.null`)
                .eq('is_active', true)
                .order('name')
            if (data) setOrderTypes(data)
        }
        loadOrderTypes()
    }, [systemType])

    useEffect(() => {
        fetchOrders()
        updateBufferCount()
    }, [systemType, currentSystem])

    // Tự động mở modal chỉnh sửa nếu có editCode trên URL
    useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        const editCode = params.get('editCode')
        if (!editCode || !systemType) return

        const handleUrlEditCode = async () => {
            // Thử tìm trong orders đang hiển thị
            const foundLocal = orders.find(o => o.code === editCode)
            if (foundLocal) {
                setSelectedOrderId(foundLocal.id)
                setIsCreateModalOpen(true)
                // Clear query string
                const newUrl = window.location.pathname
                window.history.replaceState({}, '', newUrl)
                return
            }

            // Nếu không tìm thấy, truy vấn Supabase
            try {
                const { data, error } = await supabase
                    .from('inbound_orders')
                    .select('id')
                    .eq('code', editCode)
                    .eq('system_code', systemType)
                    .single()

                if (error) throw error
                if (data) {
                    setSelectedOrderId((data as any).id)
                    setIsCreateModalOpen(true)
                }
            } catch (e) {
                console.error('Lỗi khi tìm phiếu nhập từ URL:', e)
            } finally {
                // Clear query string
                const newUrl = window.location.pathname
                window.history.replaceState({}, '', newUrl)
            }
        }

        handleUrlEditCode()
    }, [orders, systemType])


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

    async function fetchOrders(page?: number, overrideStartDate?: string, overrideEndDate?: string, overrideStatus?: string, overrideOrderType?: string) {
        let activePage = page ?? currentPage
        const _startDate = overrideStartDate !== undefined ? overrideStartDate : startDate;
        const _endDate = overrideEndDate !== undefined ? overrideEndDate : endDate;
        const _statusFilter = overrideStatus !== undefined ? overrideStatus : statusFilter;
        const _orderTypeFilter = overrideOrderType !== undefined ? overrideOrderType : orderTypeFilter;
        
        setLoading(true)
        try {
            // Đếm tổng số phiếu
            let countQuery = supabase
                .from('inbound_orders')
                .select('*', { count: 'exact', head: true })
                .eq('system_code', systemType)

            if (_statusFilter !== 'all') {
                countQuery = countQuery.eq('status', _statusFilter)
            }
            if (_orderTypeFilter !== 'all') {
                countQuery = countQuery.eq('order_type_id', _orderTypeFilter)
            }
            if (_startDate) {
                countQuery = countQuery.gte('created_at', new Date(`${_startDate}T00:00:00`).toISOString())
            }
            if (_endDate) {
                countQuery = countQuery.lte('created_at', new Date(`${_endDate}T23:59:59.999`).toISOString())
            }

            const { count } = await countQuery
            const total = count || 0
            setTotalCount(total)

            // Tự động quay về trang cuối nếu vượt quá
            const totalPages = Math.ceil(total / PAGE_SIZE)
            if (activePage >= totalPages && totalPages > 0) {
                activePage = 0
                setCurrentPage(0)
            }

            // Lấy dữ liệu theo trang
            const from = activePage * PAGE_SIZE
            const to = from + PAGE_SIZE - 1

            let query = supabase
                .from('inbound_orders')
                .select(`
                    *,
                    items:inbound_order_items(
                        id,
                        product_name,
                        quantity,
                        unit,
                        products(sku, internal_name)
                    ),
                    order_types(name),
                    supplier:suppliers(name)
                `)
                .eq('system_code', systemType)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (_statusFilter !== 'all') {
                query = query.eq('status', _statusFilter)
            }
            if (_orderTypeFilter !== 'all') {
                query = query.eq('order_type_id', _orderTypeFilter)
            }
            if (_startDate) {
                query = query.gte('created_at', new Date(`${_startDate}T00:00:00`).toISOString())
            }
            if (_endDate) {
                query = query.lte('created_at', new Date(`${_endDate}T23:59:59.999`).toISOString())
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

    const handleSearch = async (
        overrideStartDate?: string, 
        overrideEndDate?: string, 
        overrideStatus?: string, 
        overrideOrderType?: string,
        overrideSearchType?: string
    ) => {
        const cleanQuery = searchQuery.trim()
        const _startDate = overrideStartDate !== undefined ? overrideStartDate : startDate;
        const _endDate = overrideEndDate !== undefined ? overrideEndDate : endDate;
        const _statusFilter = overrideStatus !== undefined ? overrideStatus : statusFilter;
        const _orderTypeFilter = overrideOrderType !== undefined ? overrideOrderType : orderTypeFilter;
        const _searchType = overrideSearchType !== undefined ? overrideSearchType : searchType;

        if (!cleanQuery) {
            setCurrentPage(0)
            fetchOrders(0, _startDate, _endDate, _statusFilter, _orderTypeFilter)
            return
        }
        setLoading(true)
        try {
            const sanitizedQuery = cleanQuery.replace(/[,()"]/g, '').trim()
            let orConditions: string[] = []

            if (_searchType === 'code') {
                orConditions = [`code.ilike.%${sanitizedQuery}%`]
            } else if (_searchType === 'description') {
                orConditions = [`description.ilike.%${sanitizedQuery}%`]
            } else if (_searchType === 'partner') {
                const { data: suppData } = await supabase
                    .from('suppliers')
                    .select('id')
                    .eq('system_code', systemType)
                    .ilike('name', `%${sanitizedQuery}%`)
                const supplierIds = suppData?.map((s: any) => s.id) || []
                if (supplierIds.length > 0) {
                    orConditions = [`supplier_id.in.(${supplierIds.map(id => `"${id}"`).join(',')})`]
                } else {
                    orConditions = [`code.eq.__NO_MATCH__`]
                }
            } else if (_searchType === 'product') {
                let prodQuery = supabase
                    .from('products')
                    .select('id')
                    .or(`sku.ilike.%${sanitizedQuery}%,internal_name.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`)
                    .limit(100)
                if (systemType) prodQuery = prodQuery.eq('system_type', systemType)
                const { data: prodData } = await prodQuery
                const matchedProductIds: string[] = (prodData as any[])?.map((p: any) => p.id) || []

                let itemQuery = supabase
                    .from('inbound_order_items')
                    .select('order_id')
                    .limit(200)

                if (matchedProductIds.length > 0) {
                    itemQuery = itemQuery.or(`product_name.ilike.%${sanitizedQuery}%,product_id.in.(${matchedProductIds.map(id => `"${id}"`).join(',')})`)
                } else {
                    itemQuery = itemQuery.ilike('product_name', `%${sanitizedQuery}%`)
                }

                const { data: itemData } = await itemQuery
                const matchingOrderIds = Array.from(new Set((itemData as any[])?.map((it: any) => it.order_id).filter(Boolean))).slice(0, 100)

                if (matchingOrderIds.length > 0) {
                    orConditions = [`id.in.(${matchingOrderIds.map(id => `"${id}"`).join(',')})`]
                } else {
                    orConditions = [`code.eq.__NO_MATCH__`]
                }
            } else {
                // 'all': Match across all fields
                let supplierIds: string[] = []
                const { data: suppData } = await supabase
                    .from('suppliers')
                    .select('id')
                    .eq('system_code', systemType)
                    .ilike('name', `%${sanitizedQuery}%`)

                if (suppData) {
                    supplierIds = suppData.map((s: any) => s.id)
                }

                let prodQuery = supabase
                    .from('products')
                    .select('id')
                    .or(`sku.ilike.%${sanitizedQuery}%,internal_name.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`)
                    .limit(100)
                if (systemType) prodQuery = prodQuery.eq('system_type', systemType)
                const { data: prodData } = await prodQuery
                const matchedProductIds: string[] = (prodData as any[])?.map((p: any) => p.id) || []

                let itemQuery = supabase
                    .from('inbound_order_items')
                    .select('order_id')
                    .limit(200)

                if (matchedProductIds.length > 0) {
                    itemQuery = itemQuery.or(`product_name.ilike.%${sanitizedQuery}%,product_id.in.(${matchedProductIds.map(id => `"${id}"`).join(',')})`)
                } else {
                    itemQuery = itemQuery.ilike('product_name', `%${sanitizedQuery}%`)
                }

                const { data: itemData } = await itemQuery
                const matchingOrderIds = Array.from(new Set((itemData as any[])?.map((it: any) => it.order_id).filter(Boolean))).slice(0, 100)

                orConditions = [
                    `code.ilike.%${sanitizedQuery}%`,
                    `description.ilike.%${sanitizedQuery}%`
                ]
                if (supplierIds.length > 0) {
                    orConditions.push(`supplier_id.in.(${supplierIds.map(id => `"${id}"`).join(',')})`)
                }
                if (matchingOrderIds.length > 0) {
                    orConditions.push(`id.in.(${matchingOrderIds.map(id => `"${id}"`).join(',')})`)
                }
            }

            let query = supabase
                .from('inbound_orders')
                .select(`
                    *,
                    items:inbound_order_items(
                        id,
                        product_name,
                        quantity,
                        unit,
                        products(sku, internal_name)
                    ),
                    order_types(name),
                    supplier:suppliers(name)
                `)
                .eq('system_code', systemType)
                .or(orConditions.join(','))

            if (_statusFilter !== 'all') {
                query = query.eq('status', _statusFilter)
            }
            if (_orderTypeFilter !== 'all') {
                query = query.eq('order_type_id', _orderTypeFilter)
            }
            if (_startDate) {
                query = query.gte('created_at', new Date(`${_startDate}T00:00:00`).toISOString())
            }
            if (_endDate) {
                query = query.lte('created_at', new Date(`${_endDate}T23:59:59.999`).toISOString())
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(100)

            if (error) throw error
            setOrders(data || [])
            setTotalCount(data?.length || 0)
            setCurrentPage(0)
        } catch (e: any) {
            showToast('Lỗi tìm kiếm: ' + e.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function handleDeleteOrder(id: string, code: string) {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu nhập ${code}? Hành động này không thể hoàn tác.`)) return

        try {
            // 1. Delete items first
            const { error: itemsError } = await supabase
                .from('inbound_order_items')
                .delete()
                .eq('order_id', id)
            if (itemsError) throw itemsError

            // 2. Delete order
            const { error: orderError } = await supabase
                .from('inbound_orders')
                .delete()
                .eq('id', id)
            if (orderError) throw orderError

            showToast(`Đã xóa phiếu ${code} thành công`, 'success')
            fetchOrders()
            updateBufferCount()
        } catch (error: any) {
            showToast('Lỗi khi xóa phiếu: ' + error.message, 'error')
        }
    }

    async function handleResetToPending(id: string, code: string) {
        if (!window.confirm(`Bạn có muốn quay lại trạng thái Chờ duyệt cho phiếu ${code}?`)) return

        try {
            const { error } = await (supabase.from('inbound_orders') as any)
                .update({ status: 'Pending' })
                .eq('id', id)

            if (error) throw error
            showToast(`Phiếu ${code} đã quay lại trạng thái Chờ duyệt`, 'success')
            fetchOrders()
        } catch (error: any) {
            showToast('Lỗi khi cập nhật trạng thái: ' + error.message, 'error')
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

    // Batch selection handlers
    const toggleSelectOrder = (orderId: string) => {
        setSelectedOrderIds(prev => {
            const next = new Set(prev)
            if (next.has(orderId)) {
                next.delete(orderId)
            } else {
                next.add(orderId)
            }
            return next
        })
    }

    const toggleSelectAll = () => {
        const selectableOrders = orders.filter(o => o.status !== 'Cancelled')
        const allCurrentSelected = selectableOrders.length > 0 && selectableOrders.every(o => selectedOrderIds.has(o.id))
        
        setSelectedOrderIds(prev => {
            const next = new Set(prev)
            if (allCurrentSelected) {
                selectableOrders.forEach(o => next.delete(o.id))
            } else {
                selectableOrders.forEach(o => next.add(o.id))
            }
            return next
        })
    }

    const handleBatchDownload = async () => {
        if (selectedOrderIds.size === 0 || !systemType) return
        setIsBatchDownloading(true)
        try {
            const orderIdsArray = Array.from(selectedOrderIds)
            const token = (await supabase.auth.getSession()).data.session?.access_token

            const res = await fetch('/api/export/batch-inbound', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    orderIds: orderIdsArray,
                    system_code: systemType,
                    printType: 'official'
                })
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => null)
                throw new Error(errData?.error || `Lỗi ${res.status}`)
            }

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Phieu_Nhap_${orderIdsArray.length}_phieu.zip`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            window.URL.revokeObjectURL(url)

            showToast(`Đã tải ${orderIdsArray.length} phiếu nhập thành công!`, 'success')
            setSelectedOrderIds(new Set())
        } catch (error: any) {
            showToast('Lỗi tải file: ' + error.message, 'error')
        } finally {
            setIsBatchDownloading(false)
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

    const renderOrderItemsSummary = (order: any) => {
        const items = order.items || []
        if (items.length === 0) return <span className="text-gray-400 italic text-[11px]">Không có hàng hóa</span>
        
        const totalQty = items.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0)

        return (
            <button
                type="button"
                onClick={() => setPreviewItemsOrder(order)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                title="Bấm để xem danh sách mặt hàng"
            >
                <Package size={13} />
                <span>{items.length} mặt hàng</span>
                <span className="text-[11px] opacity-80">({totalQty.toLocaleString('vi-VN')})</span>
            </button>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Quản lý Nhập kho</h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Xem và quản lý các phiếu nhập kho trong hệ thống</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                    {/* Hàng chờ button */}
                    <button
                        className="relative flex items-center h-9 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                        onClick={() => setIsBufferOpen(true)}
                    >
                        <Inbox className="w-4 h-4 mr-1.5 text-amber-600 dark:text-amber-400" />
                        <span>Hàng chờ</span>
                        {bufferCount > 0 && (
                            <span className="ml-1.5 px-1.5 py-0.2 bg-red-500 text-white text-[10px] font-bold rounded-full shadow-xs leading-none">
                                {bufferCount}
                            </span>
                        )}
                    </button>

                    {/* Grouped Reports */}
                    <div className="flex items-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-0.5 shadow-xs">
                        <button
                            onClick={() => setIsAllExportModalOpen(true)}
                            className="h-8 px-2.5 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="Báo cáo Tổng hợp"
                        >
                            <FileText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Báo cáo Tổng hợp</span>
                        </button>
                        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 my-auto" />
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="h-8 px-2.5 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            title="Báo cáo Nhập"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Báo cáo Nhập</span>
                        </button>
                    </div>

                    {/* Download selected orders (Only when orders selected) */}
                    {selectedOrderIds.size > 0 && (
                        <button
                            onClick={handleBatchDownload}
                            disabled={isBatchDownloading}
                            className="flex items-center h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                        >
                            {isBatchDownloading ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5"></div>
                                    <span>Đang tải...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5 mr-1.5" />
                                    <span>Tải {selectedOrderIds.size} phiếu Excel</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Primary Action Button */}
                    <button
                        className="flex items-center h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        <span>Tạo phiếu mới</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-3.5 border-b border-gray-100 bg-stone-50/40 dark:bg-zinc-800/20 space-y-2.5">
                        {/* Row 1: Search Bar with Criteria Selector */}
                        <div className="flex items-center gap-2 w-full">
                            {/* Scope Selector */}
                            <div className="relative shrink-0">
                                <select
                                    value={searchType}
                                    onChange={(e) => {
                                        const newType = e.target.value as any;
                                        setSearchType(newType);
                                        if (searchQuery.trim()) {
                                            handleSearch(startDate, endDate, statusFilter, orderTypeFilter, newType);
                                        }
                                    }}
                                    className="h-9.5 pl-3 pr-7 bg-stone-100 hover:bg-stone-200/70 dark:bg-zinc-800 dark:hover:bg-zinc-700/70 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-stone-700 dark:text-stone-200 outline-none focus:border-indigo-500 transition-colors cursor-pointer appearance-none"
                                >
                                    <option value="all">🔍 Tất cả</option>
                                    <option value="product">📦 Sản phẩm (tên, mã)</option>
                                    <option value="description">📝 Diễn giải, ghi chú</option>
                                    <option value="code">🏷️ Mã phiếu</option>
                                    <option value="partner">👥 Nhà cung cấp</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            {/* Search Input Box */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    placeholder={
                                        searchType === 'product' ? 'Nhập mã hoặc tên sản phẩm...' :
                                        searchType === 'description' ? 'Nhập nội dung diễn giải, ghi chú...' :
                                        searchType === 'code' ? 'Nhập mã số phiếu...' :
                                        searchType === 'partner' ? 'Nhập tên nhà cung cấp...' :
                                        'Tìm theo mã phiếu, sản phẩm, diễn giải, nhà cung cấp... (Nhấn Enter để tìm)'
                                    }
                                    className="w-full pl-9 pr-9 h-9.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-xs text-stone-800 dark:text-stone-200"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => {
                                            setSearchQuery('')
                                            setCurrentPage(0)
                                            fetchOrders(0)
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full cursor-pointer"
                                        title="Xóa tìm kiếm"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Search Action Button */}
                            <button
                                onClick={() => handleSearch()}
                                className="h-9.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
                            >
                                <Search className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Tìm</span>
                            </button>
                        </div>

                        {/* Row 2: Filters Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                {/* Date Range */}
                                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 h-9">
                                    <input
                                        type="date"
                                        className="bg-transparent outline-none text-xs text-gray-600 dark:text-gray-300 w-[125px]"
                                        value={startDate}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setStartDate(newVal);
                                            setCurrentPage(0);
                                            if (searchQuery.trim()) handleSearch(newVal, endDate, statusFilter);
                                            else fetchOrders(0, newVal, endDate, statusFilter);
                                        }}
                                        title="Từ ngày"
                                    />
                                    <span className="text-gray-400 text-xs">-</span>
                                    <input
                                        type="date"
                                        className="bg-transparent outline-none text-xs text-gray-600 dark:text-gray-300 w-[125px]"
                                        value={endDate}
                                        onChange={(e) => {
                                            const newVal = e.target.value;
                                            setEndDate(newVal);
                                            setCurrentPage(0);
                                            if (searchQuery.trim()) handleSearch(startDate, newVal, statusFilter);
                                            else fetchOrders(0, startDate, newVal, statusFilter);
                                        }}
                                        title="Đến ngày"
                                    />
                                </div>

                                {/* Order Type */}
                                <select 
                                    className="h-9 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 outline-none focus:border-indigo-500 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800"
                                    value={orderTypeFilter} 
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setOrderTypeFilter(newVal);
                                        setCurrentPage(0);
                                        if (searchQuery.trim()) handleSearch(startDate, endDate, statusFilter, newVal);
                                        else fetchOrders(0, startDate, endDate, statusFilter, newVal);
                                    }}
                                >
                                    <option value="all">Tất cả loại phiếu</option>
                                    {orderTypes.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>

                                {/* Status */}
                                <select 
                                    className="h-9 border border-gray-200 dark:border-zinc-700 rounded-lg px-2.5 outline-none focus:border-indigo-500 text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800"
                                    value={statusFilter} 
                                    onChange={(e) => {
                                        const newVal = e.target.value;
                                        setStatusFilter(newVal);
                                        setCurrentPage(0);
                                        if (searchQuery.trim()) handleSearch(startDate, endDate, newVal, orderTypeFilter);
                                        else fetchOrders(0, startDate, endDate, newVal, orderTypeFilter);
                                    }}
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    <option value="Pending">Chờ duyệt</option>
                                    <option value="Processing">Đang xử lý</option>
                                    <option value="Completed">Đã hoàn tất</option>
                                    <option value="Cancelled">Đã hủy</option>
                                </select>

                                {/* Filter Submit Button */}
                                <button
                                    onClick={() => {
                                        if (searchQuery.trim()) handleSearch()
                                        else fetchOrders(0)
                                    }}
                                    className="h-9 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    <span>Lọc</span>
                                </button>

                                {/* Reset Filter Button if active */}
                                {(startDate || endDate || statusFilter !== 'all' || orderTypeFilter !== 'all' || searchQuery || searchType !== 'all') && (
                                    <button
                                        onClick={() => {
                                            setStartDate('')
                                            setEndDate('')
                                            setStatusFilter('all')
                                            setOrderTypeFilter('all')
                                            setSearchQuery('')
                                            setSearchType('all')
                                            setCurrentPage(0)
                                            fetchOrders(0, '', '', 'all', 'all')
                                        }}
                                        className="h-9 px-2.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                        title="Đặt lại bộ lọc"
                                    >
                                        Đặt lại
                                    </button>
                                )}
                            </div>

                            {/* Result stats */}
                            <div className="text-xs text-stone-500 hidden sm:block">
                                Tìm thấy: <strong className="text-stone-800 dark:text-stone-200">{totalCount}</strong> phiếu
                            </div>
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
                                            <th className="w-10 px-2 py-3 text-xs font-semibold text-gray-500 uppercase">
                                                <button onClick={toggleSelectAll} className="flex items-center justify-center w-full hover:text-indigo-600 transition-colors">
                                                    {orders.filter(o => o.status !== 'Cancelled').length > 0 && orders.filter(o => o.status !== 'Cancelled').every(o => selectedOrderIds.has(o.id)) ? (
                                                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </button>
                                            </th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Mã phiếu</th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Nhà cung cấp</th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Ngày tạo</th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Người tạo</th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                                            <th className="px-3 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {orders.map((order, index) => {
                                            const isEven = index % 2 === 0;
                                            const bgClass = isEven ? 'bg-white dark:bg-zinc-900' : 'bg-stone-50 dark:bg-zinc-800/30';
                                            const hoverBgClass = isEven ? 'hover:bg-stone-100/50 dark:hover:bg-zinc-800/50' : 'hover:bg-stone-100 dark:hover:bg-zinc-800/60';
                                            return (
                                            <React.Fragment key={order.id}>
                                                <tr className={`transition-colors ${bgClass} ${hoverBgClass}`}>
                                                    <td className="px-2 py-3 whitespace-nowrap border-b-2 border-stone-300 dark:border-zinc-700" rowSpan={2}>
                                                        <button 
                                                            disabled={order.status === 'Cancelled'}
                                                            onClick={() => toggleSelectOrder(order.id)}
                                                            className={`flex items-center justify-center w-full ${order.status === 'Cancelled' ? 'cursor-not-allowed opacity-30' : 'hover:text-indigo-600 cursor-pointer'} transition-colors`}
                                                        >
                                                            {selectedOrderIds.has(order.id) ? (
                                                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                            ) : (
                                                                <Square className="w-4 h-4 text-gray-400" />
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap border-b-2 border-stone-300 dark:border-zinc-700" rowSpan={2}>
                                                        <div className="flex flex-col items-start gap-1">
                                                            <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer" onClick={() => { setSelectedOrderId(order.id); setIsDetailModalOpen(true); }}>
                                                                {order.code}
                                                            </span>
                                                            {(() => {
                                                                const typeName = getOrderTypeName(order);
                                                                return (
                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border shadow-xs ${getOrderTypeBadgeColor(typeName)}`}>
                                                                        {typeName}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-gray-900">{order.supplier?.name || 'Hệ thống'}</span>
                                                            <span className="text-xs text-gray-500">Kho: {order.warehouse_name || '---'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <span className="text-sm text-gray-600">
                                                            {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <span className="text-sm text-gray-600">{order.created_by_name || 'Hệ thống'}</span>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${getStatusColor(order.status)} border`}>
                                                            {getStatusText(order.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-3 whitespace-nowrap text-right">
                                                        <div className="inline-flex items-center justify-end gap-1">
                                                            {/* Quick Print Button */}
                                                            <button 
                                                                onClick={() => window.open(`/print/inbound?id=${order.id}`, '_blank')}
                                                                className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="In phiếu nhập"
                                                            >
                                                                <Printer className="w-4 h-4" />
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
                                                                        const openUp = spaceBelow < 200 && spaceAbove > spaceBelow
                                                                        setActionMenu({
                                                                            id: order.id,
                                                                            top: openUp ? undefined : rect.bottom + 4,
                                                                            bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
                                                                            right: Math.max(8, window.innerWidth - rect.right)
                                                                        })
                                                                    }
                                                                }}
                                                                className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                                title="Thao tác khác"
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr className={`transition-colors ${bgClass} ${hoverBgClass}`}>
                                                    <td colSpan={5} className="px-3 py-1.5 text-xs text-gray-600 border-b-2 border-stone-300 dark:border-zinc-700">
                                                        <div className='flex items-center gap-3'>
                                                            {renderOrderItemsSummary(order)}
                                                            {order.description && (
                                                                <span className='text-gray-500 dark:text-gray-400 italic truncate max-w-[600px] border-l border-gray-200 dark:border-zinc-700 pl-3' title={order.description}>
                                                                    {order.description}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                             </React.Fragment>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Fixed Action Menu Dropdown */}
                        {actionMenu && (() => {
                            const currentActionOrder = orders.find(o => o.id === actionMenu.id)
                            if (!currentActionOrder) return null

                            return (
                                <>
                                    <div
                                        className="fixed z-50 w-44 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-stone-200 dark:border-zinc-700 py-1 text-left animate-in fade-in zoom-in-95 duration-100"
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
                                                setSelectedOrderId(id)
                                                setIsDetailModalOpen(true)
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <Eye size={13} className="text-emerald-600" />
                                            <span>Xem chi tiết</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const id = actionMenu.id
                                                setActionMenu(null)
                                                window.open(`/print/inbound?id=${id}`, '_blank')
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <Printer size={13} className="text-blue-600" />
                                            <span>In phiếu</span>
                                        </button>
                                        {currentActionOrder.status !== 'Cancelled' && (
                                            <button
                                                onClick={() => {
                                                    const id = actionMenu.id
                                                    setActionMenu(null)
                                                    setSelectedOrderId(id)
                                                    setIsCreateModalOpen(true)
                                                }}
                                                className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                                <Edit2 size={13} className="text-amber-600" />
                                                <span>Sửa phiếu</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => {
                                                const id = actionMenu.id
                                                setActionMenu(null)
                                                setDuplicateOrderId(id)
                                                setSelectedOrderId(null)
                                                setIsCreateModalOpen(true)
                                            }}
                                            className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                        >
                                            <Copy size={13} className="text-purple-600" />
                                            <span>Nhân bản</span>
                                        </button>
                                        {currentActionOrder.status === 'Completed' && (
                                            <button
                                                onClick={() => {
                                                    const id = actionMenu.id
                                                    const code = currentActionOrder.code
                                                    setActionMenu(null)
                                                    handleResetToPending(id, code)
                                                }}
                                                className="w-full px-3 py-1.5 text-xs text-stone-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-zinc-700 flex items-center gap-2 transition-colors cursor-pointer"
                                            >
                                                <RotateCcw size={13} className="text-amber-600" />
                                                <span>Quay lại Chờ duyệt</span>
                                            </button>
                                        )}
                                        {(currentActionOrder.status === 'Pending' || currentActionOrder.status === 'Cancelled') && (
                                            <>
                                                <div className="my-1 border-t border-stone-100 dark:border-zinc-700" />
                                                <button
                                                    onClick={() => {
                                                        const id = actionMenu.id
                                                        const code = currentActionOrder.code
                                                        setActionMenu(null)
                                                        handleDeleteOrder(id, code)
                                                    }}
                                                    className="w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 size={13} />
                                                    <span>Xóa phiếu</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                    <div
                                        className="fixed inset-0 z-40 bg-transparent cursor-default"
                                        onClick={() => setActionMenu(null)}
                                    />
                                </>
                            )
                        })()}

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
                                            <div className="p-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 rounded-lg">
                                                <Package size={16} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm text-stone-900 dark:text-white">
                                                    Danh sách mặt hàng - {previewItemsOrder.code}
                                                </h3>
                                                <p className="text-[11px] text-stone-500">
                                                    {previewItemsOrder.supplier?.name ? `NCC: ${previewItemsOrder.supplier.name} • ` : ''}{previewItemsOrder.items?.length || 0} mặt hàng
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
                                                            {it.products?.internal_name || it.product_name}
                                                        </td>
                                                        <td className="py-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                                                            {Number(it.quantity).toLocaleString('vi-VN')} {it.unit || ''}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="px-5 py-3 border-t border-stone-100 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 flex items-center justify-between">
                                        <span className="text-xs text-stone-500">
                                            Tổng số lượng: <strong className="text-stone-800 dark:text-stone-200">{(previewItemsOrder.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0).toLocaleString('vi-VN')}</strong>
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

                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-gray-500">
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
                                            onClick={() => { const p = currentPage - 1; setCurrentPage(p); fetchOrders(p); }}
                                            disabled={currentPage === 0}
                                            className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
                                            title="Trang trước"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="px-3 py-1 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-200 shadow-sm min-w-[80px] text-center">
                                            {currentPage + 1} / {Math.ceil(totalCount / PAGE_SIZE)}
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
                </div>

                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-600 rounded-lg">
                                <Inbox className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-indigo-600">Tổng phiếu nhập</p>
                                <h3 className="text-2xl font-bold text-gray-900">{totalCount}</h3>
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
                    onClose={() => { setIsCreateModalOpen(false); setSelectedOrderId(null); setDuplicateOrderId(null); }}
                    onSuccess={() => {
                        fetchOrders();
                        showToast(`Phiếu nhập ${selectedOrderId ? 'đã cập nhật' : 'đã tạo'} thành công!`, 'success');
                        setSelectedOrderId(null);
                        setDuplicateOrderId(null);
                    }}
                    editOrderId={selectedOrderId || undefined}
                    duplicateOrderId={duplicateOrderId || undefined}
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
