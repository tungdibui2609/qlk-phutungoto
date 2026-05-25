'use client'

import { useState, useEffect } from 'react'
import { format, startOfDay, endOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Search, Calendar, FileText, CheckCircle2, AlertCircle, RefreshCw, XCircle, Clock, X } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { calculateNewInQtyByProduct } from '@/lib/lotSummaryUtils'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import Link from 'next/link'

type LotReconciliationData = {
    id: string
    product_name: string | null
    actualQty: number
    accountingQty: number
    diff: number
    orderCodes: string[]
    relatedLots: string[]
    status: 'matched' | 'mismatched' | 'no_order' | 'draft'
}

export default function LotReconciliationTable() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    
    // Default to today
    const [startDate, setStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'))
    
    const [loading, setLoading] = useState(false)
    const [balancingCode, setBalancingCode] = useState<string | null>(null)
    const [data, setData] = useState<LotReconciliationData[]>([])
    const [filterStatus, setFilterStatus] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedLotsModal, setSelectedLotsModal] = useState<{ productName: string, lots: string[] } | null>(null)


    const fetchData = async () => {
        if (!currentSystem?.code) return
        if (!startDate || !endDate) {
            showToast('Vui lòng chọn khoảng thời gian hợp lệ', 'error')
            return
        }

        setLoading(true)
        try {
            const start = new Date(startDate)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDate)
            end.setHours(23, 59, 59, 999)
            
            const startStr = format(start, "yyyy-MM-dd")
            const endStr = format(end, "yyyy-MM-dd")

            const { data: lots, error } = await supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    status,
                    created_at,
                    inbound_date,
                    metadata,
                    product_id,
                    quantity,
                    products(name),
                    lot_items(id, quantity, product_id, unit, products(name, unit))
                `)
                .eq('system_code', currentSystem.code)
                .neq('status', 'hidden')
                .or(`inbound_date.gte.${startStr},created_at.gte.${format(start, "yyyy-MM-dd'T'00:00:00")}`)
                .order('created_at', { ascending: false })
            
            if (error) throw error

            const productMap = new Map<string, LotReconciliationData>()

            // === SỬ DỤNG HÀM DÙNG CHUNG ĐỂ TÍNH newInQty ===
            // Logic CHÍNH XÁC giống Báo cáo Lot (summaryInward)
            // Chỉ lọc những lot nằm trong khoảng ngày đã chọn
            const filteredLots = (lots || []).filter(lot => {
                const effectiveDateStr = lot.inbound_date || lot.created_at;
                const effectiveDate = new Date(effectiveDateStr);
                const isDateInRange = effectiveDate >= start && effectiveDate <= end;
                if (!isDateInRange) return false;

                const hasInventoryData = (lot.lot_items && lot.lot_items.length > 0) || 
                                         (lot.metadata as any)?.system_history?.merged_out?.length > 0;
                const isExported = lot.status === 'exported';
                const createdAt = new Date(lot.created_at);
                const isCreatedInRange = createdAt >= start && createdAt <= end;

                if (isExported && !hasInventoryData && !isCreatedInRange) {
                    return false; // Bỏ qua ghost lot
                }
                return true;
            })

            // Tính newInQty cho mỗi sản phẩm — dùng CHÍNH XÁC logic Báo cáo Lot
            const newInSummary = calculateNewInQtyByProduct(filteredLots)

            // DEBUG: In ra để kiểm tra
            console.log('=== ĐỐI CHIẾU DEBUG ===')
            newInSummary.forEach((summary, pid) => {
                console.log(`[${summary.product_name}] newInQty=${summary.newInQty}, mergedIn=${summary.mergedInQty}, mergedOut=${summary.mergedOutQty}, total=${summary.totalQty}`)
            })

            // Chuyển kết quả sang productMap
            newInSummary.forEach((summary, pid) => {
                // CHỈ lấy sản phẩm có newInQty > 0 (có chữ "Mới" trên Báo cáo Lot)
                if (summary.newInQty > 0) {
                    productMap.set(pid, {
                        id: pid,
                        product_name: summary.product_name,
                        actualQty: summary.newInQty, // Dùng ĐÚNG con số "Mới" từ Báo cáo Lot
                        accountingQty: 0,
                        diff: 0,
                        orderCodes: [],
                        relatedLots: summary.lotCodes,
                        status: 'matched'
                    })
                }
            })

            // === Tính accountingQty từ metadata inbound của từng lot ===
            filteredLots.forEach(lot => {
                const history = (lot.metadata as any)?.system_history || {}
                const rawInbound = history.inbound || []
                const rawSyncInbound = history.accounting_sync?.inbound || []
                
                const inbounds = [
                    ...(Array.isArray(rawInbound) ? rawInbound : [rawInbound]),
                    ...(Array.isArray(rawSyncInbound) ? rawSyncInbound : [rawSyncInbound])
                ]

                inbounds.forEach((inc: any) => {
                    if (inc.draft) {
                        if (inc.items) {
                            Object.values(inc.items).forEach((item: any) => {
                                const pId = item.product_id
                                if (pId && productMap.has(pId)) {
                                    productMap.get(pId)!.status = 'draft'
                                }
                            })
                        }
                    } else if (inc.items) {
                        Object.values(inc.items).forEach((item: any) => {
                            const pId = item.product_id
                            if (pId && productMap.has(pId)) {
                                const pData = productMap.get(pId)!
                                pData.accountingQty += (item.quantity || 0)
                                if (inc.order_code && !pData.orderCodes.includes(inc.order_code)) {
                                    pData.orderCodes.push(inc.order_code)
                                }
                            }
                        })
                    }
                })
            })

            // Fetch Inbound Orders for the same period to catch any missing products 
            // that accountants created but warehouse hasn't created lots for
            const { data: inboundOrders } = await supabase
                .from('inbound_orders')
                .select(`
                    code,
                    status,
                    inbound_order_items(quantity, product_id, products(name))
                `)
                .eq('system_code', currentSystem.code)
                .neq('status', 'Cancelled')
                .gte('created_at', format(start, "yyyy-MM-dd'T'00:00:00"))
                .lte('created_at', format(end, "yyyy-MM-dd'T'23:59:59"))

            ;(inboundOrders || []).forEach(order => {
                order.inbound_order_items?.forEach((item: any) => {
                    const pId = item.product_id
                    const qty = item.quantity || 0
                    if (pId) {
                        if (!productMap.has(pId)) {
                            productMap.set(pId, {
                                id: pId,
                                product_name: item.products?.name || 'Sản phẩm',
                                actualQty: 0,
                                accountingQty: 0,
                                diff: 0,
                                orderCodes: [],
                                relatedLots: [],
                                status: 'matched'
                            })
                        }
                        
                        const pData = productMap.get(pId)!
                        // We only add to accountingQty if this order wasn't ALREADY linked to a lot
                        if (!pData.orderCodes.includes(order.code)) {
                            pData.accountingQty += qty
                            pData.orderCodes.push(order.code)
                        }
                    }
                })
            })

            // Calculate diffs and determine status
            const processed = Array.from(productMap.values()).map(pData => {
                pData.diff = pData.actualQty - pData.accountingQty
                
                if (pData.status !== 'draft') {
                    if (pData.actualQty === 0 && pData.accountingQty === 0) {
                        pData.status = 'matched'
                    } else if (pData.actualQty > 0 && pData.accountingQty === 0) {
                        pData.status = 'no_order'
                    } else if (pData.diff !== 0) {
                        pData.status = 'mismatched'
                    } else {
                        pData.status = 'matched'
                    }
                }
                
                return pData
            }).filter(p => p.actualQty > 0 || p.accountingQty > 0) // Lọc bỏ nếu cả 2 đều bằng 0

            setData(processed)
        } catch (error: any) {
            console.error(error)
            showToast('Lỗi khi tải dữ liệu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleQuickBalance = async (row: LotReconciliationData, orderCode: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn cân bằng số lượng cho sản phẩm "${row.product_name}" trong phiếu nhập "${orderCode}" thành ${row.actualQty} không?`)) {
            return
        }

        setBalancingCode(orderCode)
        try {
            // 1. Fetch the inbound order by code and system_code
            const { data: order, error: orderError } = await supabase
                .from('inbound_orders')
                .select('id, status')
                .eq('code', orderCode)
                .eq('system_code', currentSystem?.code)
                .single()

            if (orderError || !order) {
                throw new Error(orderError?.message || 'Không tìm thấy phiếu nhập này')
            }

            if (order.status === 'Completed') {
                if (!window.confirm(`Phiếu nhập "${orderCode}" đã HOÀN TẤT. Bạn có chắc chắn vẫn muốn chỉnh sửa số lượng không?`)) {
                    setBalancingCode(null)
                    return
                }
            }

            // 2. Fetch order items for this order and product
            const { data: items, error: itemsError } = await supabase
                .from('inbound_order_items')
                .select('id, quantity')
                .eq('order_id', order.id)
                .eq('product_id', row.id)

            if (itemsError) throw itemsError

            if (items && items.length > 0) {
                // Update existing item
                const { error: updateError } = await supabase
                    .from('inbound_order_items')
                    .update({
                        quantity: row.actualQty,
                        document_quantity: row.actualQty
                    })
                    .eq('id', items[0].id)

                if (updateError) throw updateError
            } else {
                // Insert new item if not exists
                // Fetch product details for name and unit
                const { data: prod } = await supabase
                    .from('products')
                    .select('name, unit, category_id')
                    .eq('id', row.id)
                    .single()

                const { error: insertError } = await supabase
                    .from('inbound_order_items')
                    .insert({
                        order_id: order.id,
                        product_id: row.id,
                        product_name: prod?.name || row.product_name,
                        unit: prod?.unit || '-',
                        quantity: row.actualQty,
                        document_quantity: row.actualQty,
                        price: 0,
                        category_id: prod?.category_id || null
                    })

                if (insertError) throw insertError
            }

            showToast(`Cân bằng phiếu nhập ${orderCode} thành công!`, 'success')
            fetchData()
        } catch (e: any) {
            console.error(e)
            showToast('Lỗi khi cân bằng phiếu: ' + e.message, 'error')
        } finally {
            setBalancingCode(null)
        }
    }


    // Auto-fetch on mount
    useEffect(() => {
        if (currentSystem?.code) {
            fetchData()
        }
    }, [currentSystem?.code])

    // Filter Data
    const filteredData = data.filter(item => {
        if (filterStatus !== 'all' && item.status !== filterStatus) return false
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            return item.product_name?.toLowerCase().includes(query) ||
                   item.orderCodes.some(c => c.toLowerCase().includes(query)) ||
                   item.relatedLots.some(c => c.toLowerCase().includes(query))
        }
        return true
    })

    const getStatusBadge = (status: LotReconciliationData['status']) => {
        switch (status) {
            case 'matched':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5"/> Khớp</span>
            case 'mismatched':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200"><AlertCircle className="w-3.5 h-3.5"/> Bị lệch</span>
            case 'no_order':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-200"><XCircle className="w-3.5 h-3.5"/> Chưa lên phiếu</span>
            case 'draft':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200"><Clock className="w-3.5 h-3.5"/> Đang chờ (Nháp)</span>
        }
    }

    // Stats
    const totalLots = data.length
    const mismatchedLots = data.filter(d => d.status === 'mismatched').length
    const matchedLots = data.filter(d => d.status === 'matched').length
    const noOrderLots = data.filter(d => d.status === 'no_order').length

    return (
        <div className="flex-1 overflow-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header & Controls */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-stone-800">Đối chiếu Nhập kho Kế toán & Lot</h1>
                        <p className="text-stone-500 text-sm mt-1">Phát hiện các sai lệch do thao tác sửa đổi Lot sau khi đã lên phiếu Kế toán</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-stone-200 shadow-sm">
                            <Calendar className="w-4 h-4 text-stone-400" />
                            <input 
                                type="date"
                                className="text-sm outline-none text-stone-700 bg-transparent"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <span className="text-stone-400">-</span>
                            <input 
                                type="date"
                                className="text-sm outline-none text-stone-700 bg-transparent"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={fetchData}
                            disabled={loading}
                            className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Kiểm tra
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-stone-100 rounded-lg">
                            <FileText className="w-6 h-6 text-stone-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-stone-500">Số Sản phẩm</p>
                            <h3 className="text-2xl font-bold text-stone-800">{totalLots}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-lg">
                            <AlertCircle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-red-600">Lệch số lượng</p>
                            <h3 className="text-2xl font-bold text-stone-800">{mismatchedLots}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-emerald-600">Đã khớp</p>
                            <h3 className="text-2xl font-bold text-stone-800">{matchedLots}</h3>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
                        <div className="p-3 bg-stone-100 rounded-lg">
                            <XCircle className="w-6 h-6 text-stone-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-stone-600">Chưa tạo phiếu</p>
                            <h3 className="text-2xl font-bold text-stone-800">{noOrderLots}</h3>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden flex flex-col min-h-[500px]">
                    <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="relative max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                            <input 
                                type="text"
                                placeholder="Tìm mã Lot, mã phiếu, sản phẩm..."
                                className="w-full pl-9 h-9 text-sm border border-stone-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-stone-500 font-medium">Lọc trạng thái:</span>
                            <select 
                                className="h-9 border border-stone-200 rounded-md px-3 text-sm outline-none focus:border-indigo-500 bg-white"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Tất cả</option>
                                <option value="mismatched">Bị lệch</option>
                                <option value="matched">Khớp</option>
                                <option value="no_order">Chưa tạo phiếu</option>
                                <option value="draft">Đang nháp</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-stone-50 border-b border-stone-200">
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Sản phẩm</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Các mã Lot liên quan</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-right">SL trên Lot</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-right">SL Kế toán</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase text-right">Chênh lệch</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Trạng thái</th>
                                    <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase">Phiếu nhập (PNK)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-stone-500">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-stone-500">
                                            Không có dữ liệu phù hợp
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map(row => (
                                        <tr key={row.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 text-sm font-medium text-indigo-600 max-w-[250px] break-words">
                                                {row.product_name}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-stone-500 max-w-[200px] truncate">
                                                {row.relatedLots.length > 0 ? (
                                                    <button 
                                                        onClick={() => setSelectedLotsModal({ productName: row.product_name || 'Sản phẩm', lots: row.relatedLots })}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-md transition-colors text-xs"
                                                    >
                                                        Xem {row.relatedLots.length} Lot liên quan
                                                    </button>
                                                ) : '---'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-stone-800 text-right">
                                                {row.actualQty.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-600 text-right">
                                                {row.accountingQty.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-right">
                                                {row.diff > 0 ? (
                                                    <span className="text-emerald-600">+{row.diff.toLocaleString('vi-VN')}</span>
                                                ) : row.diff < 0 ? (
                                                    <span className="text-red-600">{row.diff.toLocaleString('vi-VN')}</span>
                                                ) : (
                                                    <span className="text-stone-400">0</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {getStatusBadge(row.status)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-600">
                                                {row.orderCodes.length > 0 ? (
                                                    <div className="flex flex-col gap-1.5">
                                                        {row.orderCodes.map(code => (
                                                            <div key={code} className="flex items-center gap-2">
                                                                <Link href={`/inbound?editCode=${code}`} className="text-indigo-600 hover:underline font-semibold">
                                                                    {code}
                                                                </Link>
                                                                {row.status === 'mismatched' && (
                                                                    <button
                                                                        onClick={() => handleQuickBalance(row, code)}
                                                                        disabled={balancingCode === code}
                                                                        className="px-2 py-0.5 text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold rounded border border-amber-200 transition-all flex items-center gap-1 disabled:opacity-50"
                                                                        title="Tự động cân bằng số lượng trên phiếu nhập theo số lượng thực tế từ Lot"
                                                                    >
                                                                        {balancingCode === code ? (
                                                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                                                        ) : null}
                                                                        Cân bằng
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-stone-400 text-xs">---</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 border-t border-stone-100 bg-stone-50 text-xs text-stone-500 text-right">
                        Hiển thị {filteredData.length} kết quả
                    </div>
                </div>
            </div>

            {/* Modal Danh sách Lot */}
            {selectedLotsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-4 border-b border-stone-200">
                            <div>
                                <h3 className="text-lg font-bold text-stone-800">Các mã Lot liên quan</h3>
                                <p className="text-sm text-stone-500 truncate max-w-[300px]">{selectedLotsModal.productName}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedLotsModal(null)}
                                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto">
                            <div className="flex flex-col gap-2">
                                {selectedLotsModal.lots.map(code => (
                                    <Link 
                                        key={code} 
                                        href={`/warehouses/lots?search=${code}`} 
                                        className="px-3 py-2 bg-stone-50 hover:bg-indigo-50 border border-stone-200 hover:border-indigo-200 rounded-lg text-sm text-stone-700 hover:text-indigo-700 transition-colors flex items-center justify-between group"
                                    >
                                        <span className="font-medium">{code}</span>
                                        <span className="text-xs text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">Xem chi tiết &rarr;</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
