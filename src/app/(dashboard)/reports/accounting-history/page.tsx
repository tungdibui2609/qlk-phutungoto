'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Download, Calendar, Boxes, Building2, User, FileText, Filter, Layers, ChevronDown, DollarSign, ArrowUpRight, ArrowDownLeft, PackageSearch, TrendingUp } from 'lucide-react'
import { format, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'

type OrderType = {
    id: string
    name: string
    code: string
    scope: 'inbound' | 'outbound' | 'both'
}

type ProductMovement = {
    productId: string
    sku: string
    name: string
    unit: string
    opening: number
    inboundItems: Record<string, number> // orderTypeId -> quantity
    outboundItems: Record<string, number> // orderTypeId -> quantity
    totalIn: number
    totalOut: number
    closing: number
    vouchers: Set<string>
}

export default function AccountingHistoryPage() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

    const [products, setProducts] = useState<any[]>([])
    const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
    const [movements, setMovements] = useState<ProductMovement[]>([])
    const [selectedVouchersProduct, setSelectedVouchersProduct] = useState<any | null>(null)

    useEffect(() => {
        fetchData()
    }, [systemType, startDate, endDate])

    async function fetchData() {
        setLoading(true)
        try {
            // 1. Fetch Products for this system
            const { data: prodData } = await supabase
                .from('products')
                .select('id, sku, name, unit')
                .eq('system_type', systemType)

            if (!prodData) return
            setProducts(prodData)

            // 2. Fetch Order Types
            const { data: typeData } = await (supabase.from('order_types') as any)
                .select('*')
                .eq('is_active', true)
                .or(`system_code.eq.${systemType},system_code.is.null`)

            setOrderTypes(typeData || [])

            // 3. Fetch Inbound Movements (All history to calculate opening)
            const { data: inboundItems } = await supabase
                .from('inbound_order_items')
                .select(`
                    quantity,
                    product_id,
                    order:inbound_orders(code, created_at, order_type_id, status)
                `)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')

            // 4. Fetch Outbound Movements
            const { data: outboundItems } = await supabase
                .from('outbound_order_items')
                .select(`
                    quantity,
                    product_id,
                    order:outbound_orders(code, created_at, order_type_id, status)
                `)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')

            // 5. Calculate NXT
            const start = parseISO(startDate)
            const end = parseISO(endDate + 'T23:59:59')

            const movementMap: Record<string, ProductMovement> = {}

            prodData.forEach(p => {
                movementMap[p.id] = {
                    productId: p.id,
                    sku: p.sku || 'N/A',
                    name: p.name,
                    unit: p.unit || '-',
                    opening: 0,
                    inboundItems: {},
                    outboundItems: {},
                    totalIn: 0,
                    totalOut: 0,
                    closing: 0,
                    vouchers: new Set()
                }
            })

            // Process Inbound
            inboundItems?.forEach((item: any) => {
                const mov = movementMap[item.product_id]
                if (!mov) return

                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start)) {
                    mov.opening += (item.quantity || 0)
                } else if (isBefore(orderDate, end)) {
                    const typeId = item.order.order_type_id || 'untyped'
                    mov.inboundItems[typeId] = (mov.inboundItems[typeId] || 0) + (item.quantity || 0)
                    mov.totalIn += (item.quantity || 0)
                    mov.vouchers.add(item.order.code)
                }
            })

            // Process Outbound
            outboundItems?.forEach((item: any) => {
                const mov = movementMap[item.product_id]
                if (!mov) return

                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start)) {
                    mov.opening -= (item.quantity || 0)
                } else if (isBefore(orderDate, end)) {
                    const typeId = item.order.order_type_id || 'untyped'
                    mov.outboundItems[typeId] = (mov.outboundItems[typeId] || 0) + (item.quantity || 0)
                    mov.totalOut += (item.quantity || 0)
                    mov.vouchers.add(item.order.code)
                }
            })

            // Finalize calculation
            Object.values(movementMap).forEach(mov => {
                mov.closing = mov.opening + mov.totalIn - mov.totalOut
            })

            setMovements(Object.values(movementMap))

        } catch (error) {
            console.error('Error fetching NXT data:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredMovements = movements.filter(m =>
        m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(m => m.opening !== 0 || m.totalIn !== 0 || m.totalOut !== 0)

    // Dynamic columns for Order Types
    const inboundTypes = orderTypes.filter(t => t.scope === 'inbound' || t.scope === 'both')
    const outboundTypes = orderTypes.filter(t => t.scope === 'outbound' || t.scope === 'both')

    // Summaries
    const summary = useMemo(() => {
        return filteredMovements.reduce((acc, curr) => ({
            products: acc.products + 1,
            opening: acc.opening + curr.opening,
            inbound: acc.inbound + curr.totalIn,
            outbound: acc.outbound + curr.totalOut,
            closing: acc.closing + curr.closing
        }), { products: 0, opening: 0, inbound: 0, outbound: 0, closing: 0 })
    }, [filteredMovements])

    return (
        <div className="space-y-6 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-800">
                            <Layers size={24} strokeWidth={2.5} />
                        </div>
                        Báo cáo Nhập - Xuất - Tồn (KT)
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11 italic">
                        Thống kê chi tiết biến động kho theo mục đích nhập xuất.
                    </p>
                </div>

                <button
                    onClick={() => { }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20 w-fit"
                >
                    <Download size={18} />
                    Xuất Excel
                </button>
            </div>

            {/* Dashboard Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Tổng sản phẩm</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white tabular-nums">{summary.products}</h3>
                        <div className="p-1 px-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-500 text-[10px] font-bold">SP</div>
                    </div>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider mb-1">Tồn đầu kỳ</p>
                    <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums">{formatQuantityFull(summary.opening)}</h3>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-400 dark:text-emerald-500 uppercase tracking-wider mb-1">Nhập trong kỳ</p>
                    <div className="flex items-center gap-2">
                        <ArrowDownLeft size={16} className="text-emerald-500" />
                        <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatQuantityFull(summary.inbound)}</h3>
                    </div>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-orange-400 dark:text-orange-500 uppercase tracking-wider mb-1">Xuất trong kỳ</p>
                    <div className="flex items-center gap-2">
                        <ArrowUpRight size={16} className="text-orange-500" />
                        <h3 className="text-2xl font-black text-orange-700 dark:text-orange-400 tabular-nums">{formatQuantityFull(summary.outbound)}</h3>
                    </div>
                </div>
                <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-purple-400 dark:text-purple-500 uppercase tracking-wider mb-1">Tồn cuối kỳ</p>
                    <h3 className="text-2xl font-black text-purple-700 dark:text-purple-400 tabular-nums">{formatQuantityFull(summary.closing)}</h3>
                </div>
            </div>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm sticky top-4 z-10">
                <div className="relative group md:col-span-2">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm mã SP, tên sản phẩm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1 group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={16} />
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full pl-9 pr-2 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold appearance-none"
                        />
                    </div>
                    <span className="text-stone-300"> đến </span>
                    <div className="relative flex-1 group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={16} />
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full pl-9 pr-2 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold appearance-none"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchData()}
                        className="flex-1 py-2.5 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-slate-700 transition-all"
                    >
                        Tải lại dữ liệu
                    </button>
                </div>
            </div>

            {/* NXT Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden text-[11px]">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                            <p className="mt-4 text-stone-500 font-medium">Đang hạch toán dữ liệu...</p>
                        </div>
                    ) : filteredMovements.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="p-4 bg-stone-50 dark:bg-slate-800 rounded-full mb-4">
                                <PackageSearch className="opacity-20" size={48} />
                            </div>
                            <p className="text-stone-500 font-medium">Không có biến động hàng hóa trong kỳ này</p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50">
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-24">Mã SP</th>
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider min-w-[200px]">Tên Sản Phẩm</th>
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-blue-500 tracking-wider w-24">Tồn đầu kỳ</th>

                                    {/* Nhập Kho Header */}
                                    <th colSpan={inboundTypes.length + 1} className="px-4 py-2 border-r border-b border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/5 text-center font-black uppercase text-emerald-600 tracking-widest border-t-2 border-t-emerald-500">NHẬP KHO</th>

                                    {/* Xuất Kho Header */}
                                    <th colSpan={outboundTypes.length + 1} className="px-4 py-2 border-r border-b border-orange-100 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/5 text-center font-black uppercase text-orange-600 tracking-widest border-t-2 border-t-orange-500">XUẤT KHO</th>

                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-purple-500 tracking-wider w-24">Tồn cuối kỳ</th>
                                    <th rowSpan={2} className="px-4 py-4 border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-stone-400 tracking-wider w-16">Vouchers</th>
                                </tr>
                                <tr className="bg-stone-50/30 dark:bg-slate-800/30 text-[10px]">
                                    {inboundTypes.map(t => (
                                        <th key={t.id} className="px-2 py-3 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold text-stone-500">{t.name}</th>
                                    ))}
                                    <th className="px-2 py-3 border-r border-b border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 text-center font-black text-emerald-600">TỔNG NHẬP</th>

                                    {outboundTypes.map(t => (
                                        <th key={t.id} className="px-2 py-3 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold text-stone-500">{t.name}</th>
                                    ))}
                                    <th className="px-2 py-3 border-r border-b border-orange-200 dark:border-orange-800 bg-orange-500/10 text-center font-black text-orange-600">TỔNG XUẤT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredMovements.map(mov => (
                                    <tr key={mov.productId} className="group hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors">
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 font-mono font-bold text-stone-400">{mov.sku}</td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800">
                                            <div className="font-bold text-stone-800 dark:text-stone-200">{mov.name}</div>
                                            <div className="text-[10px] text-stone-400 italic">({mov.unit})</div>
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 text-center font-bold text-blue-600 tabular-nums bg-blue-50/10">
                                            {formatQuantityFull(mov.opening)}
                                        </td>

                                        {/* Inbound Details */}
                                        {inboundTypes.map(t => (
                                            <td key={t.id} className="px-2 py-3 border-r border-stone-100 dark:border-slate-800 text-center text-stone-500 tabular-nums">
                                                {mov.inboundItems[t.id] ? formatQuantityFull(mov.inboundItems[t.id]) : '-'}
                                            </td>
                                        ))}
                                        <td className="px-2 py-3 border-r border-emerald-100 dark:border-emerald-900 text-center font-black text-emerald-600 tabular-nums bg-emerald-50/20 dark:bg-emerald-900/5">
                                            {mov.totalIn ? formatQuantityFull(mov.totalIn) : '-'}
                                        </td>

                                        {/* Outbound Details */}
                                        {outboundTypes.map(t => (
                                            <td key={t.id} className="px-2 py-3 border-r border-stone-100 dark:border-slate-800 text-center text-stone-500 tabular-nums">
                                                {mov.outboundItems[t.id] ? formatQuantityFull(mov.outboundItems[t.id]) : '-'}
                                            </td>
                                        ))}
                                        <td className="px-2 py-3 border-r border-orange-100 dark:border-orange-900 text-center font-black text-orange-600 tabular-nums bg-orange-50/20 dark:bg-orange-900/5">
                                            {mov.totalOut ? formatQuantityFull(mov.totalOut) : '-'}
                                        </td>

                                        <td className="px-4 py-3 border-r border-purple-100 dark:border-purple-900 text-center font-black text-purple-600 tabular-nums bg-purple-50/20 dark:bg-purple-900/5">
                                            {formatQuantityFull(mov.closing)}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    onClick={() => setSelectedVouchersProduct({ id: mov.productId, name: mov.name, sku: mov.sku })}
                                                    className="p-1 px-2 rounded bg-stone-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-stone-500 hover:text-indigo-600 transition-colors font-bold"
                                                >
                                                    {mov.vouchers.size}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-stone-50 dark:bg-slate-800/80 font-black text-stone-900 dark:text-white sticky bottom-0">
                                <tr>
                                    <td colSpan={2} className="px-4 py-4 text-right uppercase tracking-wider border-t-2 border-indigo-500">Tổng cộng kỳ này</td>
                                    <td className="px-4 py-4 text-center border-t-2 border-indigo-500 text-blue-600">{formatQuantityFull(summary.opening)}</td>

                                    {/* Inbound TFoot Spacer & Total */}
                                    <td colSpan={inboundTypes.length} className="px-4 py-4 border-t-2 border-indigo-500"></td>
                                    <td className="px-2 py-4 text-center border-t-2 border-indigo-500 text-emerald-600 bg-emerald-500/10">{formatQuantityFull(summary.inbound)}</td>

                                    {/* Outbound TFoot Spacer & Total */}
                                    <td colSpan={outboundTypes.length} className="px-4 py-4 border-t-2 border-indigo-500"></td>
                                    <td className="px-2 py-4 text-center border-t-2 border-indigo-500 text-orange-600 bg-orange-500/10">{formatQuantityFull(summary.outbound)}</td>

                                    <td className="px-4 py-4 text-center border-t-2 border-indigo-500 text-purple-600 bg-purple-500/10">{formatQuantityFull(summary.closing)}</td>
                                    <td className="border-t-2 border-indigo-500"></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            {/* Hint Section */}
            <div className="bg-stone-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 flex items-start gap-3">
                <div className="p-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg">
                    <TrendingUp size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Ghi chú hạch toán</p>
                    <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                        Dữ liệu "Tồn đầu kỳ" được tổng hợp từ toàn bộ các phiếu đã hoàn thành trước ngày bắt đầu chọn.
                        Các cột Nhập/Xuất chi tiết được phân rã dựa trên <strong>Loại phiếu</strong> được cấu hình trong hệ thống.
                        Chỉ các phiếu ở trạng thái <strong>"Hoàn thành"</strong> mới được ghi nhận vào báo cáo này.
                    </p>
                </div>
            </div>

            {/* Voucher Detail Modal */}
            <VoucherDetailModal
                isOpen={!!selectedVouchersProduct}
                onClose={() => setSelectedVouchersProduct(null)}
                productId={selectedVouchersProduct?.id || ''}
                productName={selectedVouchersProduct?.name || ''}
                sku={selectedVouchersProduct?.sku || ''}
                startDate={startDate}
                endDate={endDate}
                systemType={systemType}
                orderTypes={orderTypes}
            />
        </div>
    )
}

function VoucherDetailModal({ isOpen, onClose, productId, productName, sku, startDate, endDate, systemType, orderTypes }: any) {
    const [loading, setLoading] = useState(false)
    const [vouchers, setVouchers] = useState<any[]>([])

    useEffect(() => {
        if (isOpen && productId) {
            fetchVouchers()
        }
    }, [isOpen, productId, startDate, endDate])

    async function fetchVouchers() {
        setLoading(true)
        try {
            const start = startDate
            const end = endDate + 'T23:59:59'

            // Fetch Inbound
            const { data: inbound } = await supabase
                .from('inbound_order_items')
                .select(`
                    id, quantity,
                    order:inbound_orders(code, created_at, order_type_id, status)
                `)
                .eq('product_id', productId)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')
                .gte('order.created_at', start)
                .lte('order.created_at', end)

            // Fetch Outbound
            const { data: outbound } = await supabase
                .from('outbound_order_items')
                .select(`
                    id, quantity,
                    order:outbound_orders(code, created_at, order_type_id, status)
                `)
                .eq('product_id', productId)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')
                .gte('order.created_at', start)
                .lte('order.created_at', end)

            const normalized = [
                ...(inbound || []).map((v: any) => ({ ...v, type: 'in' })),
                ...(outbound || []).map((v: any) => ({ ...v, type: 'out' }))
            ].sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime())

            setVouchers(normalized)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-stone-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between bg-stone-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                            Biến động: <span className="text-indigo-600 dark:text-indigo-400">{sku}</span>
                        </h2>
                        <p className="text-sm text-stone-500 font-medium">{productName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-stone-400">
                        <ChevronDown size={24} className="rotate-90" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                        </div>
                    ) : vouchers.length === 0 ? (
                        <div className="py-20 text-center text-stone-400 font-medium">Không tìm thấy phiếu nào</div>
                    ) : (
                        <div className="space-y-3">
                            {vouchers.map((v, i) => {
                                const typeName = orderTypes.find((t: any) => t.id === v.order.order_type_id)?.name || 'Không xác định'
                                return (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl ${v.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                {v.type === 'in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                            </div>
                                            <div>
                                                <div className="font-mono font-bold text-sm text-stone-900 dark:text-white uppercase">{v.order.code}</div>
                                                <div className="flex items-center gap-2 text-[10px] uppercase font-black text-stone-400 mt-0.5">
                                                    <span>{typeName}</span>
                                                    <span>•</span>
                                                    <span>{format(parseISO(v.order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-black ${v.type === 'in' ? 'text-emerald-600' : 'text-orange-600'
                                                }`}>
                                                {v.type === 'in' ? '+' : '-'}{formatQuantityFull(v.quantity)}
                                            </div>
                                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{v.type === 'in' ? 'Nhập kho' : 'Xuất kho'}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-stone-50 dark:bg-slate-800/50 text-center border-t border-stone-100 dark:border-slate-800">
                    <button onClick={onClose} className="px-8 py-2.5 bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 rounded-xl text-sm font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition-all shadow-sm">
                        Đóng chi tiết
                    </button>
                </div>
            </div>
        </div>
    )
}
