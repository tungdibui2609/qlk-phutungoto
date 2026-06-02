'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { 
    History, Search, Calendar, RefreshCw, FileText, ChevronLeft, ChevronRight, 
    Tag, Boxes, Package, User, QrCode, ScanLine, MapPin, ShieldCheck, Activity,
    TrendingUp, ExternalLink, Box, Eye, X
} from 'lucide-react'

interface PrintLog {
    id: string
    semi_finished_lot_code: string
    finished_lot_code: string
    product_id: string
    print_qty: number
    start_index: number
    end_index: number
    created_at: string
    created_by: string | null
    products: {
        name: string
        sku: string
        internal_name: string | null
    } | null
}

interface ProductFilter {
    id: string
    name: string
    sku: string
    internal_name: string | null
}

export default function PrintHistoryPage() {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()
    const { profile } = useUser()

    // Tab active state
    const [activeTab, setActiveTab] = useState<'sao-ke' | 'truy-vet'>('sao-ke')

    // ==========================================
    // STATE CHO TAB 1: SAO KÊ LỊCH SỬ IN TEM
    // ==========================================
    const [logs, setLogs] = useState<PrintLog[]>([])
    const [products, setProducts] = useState<ProductFilter[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)

    // State bộ lọc sao kê
    const [filterSemiLot, setFilterSemiLot] = useState('')
    const [filterFinishedLot, setFilterFinishedLot] = useState('')
    const [filterProductId, setFilterProductId] = useState('')
    const [filterDateRange, setFilterDateRange] = useState('all')

    // Phân trang
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // ==========================================
    // STATE CHO TAB 2: TRUY VẾT & ĐỊNH VỊ
    // ==========================================
    // 1. Truy vết xuôi (Theo Lô BTP & TP)
    const [traceSemiLot, setTraceSemiLot] = useState('')
    const [traceFinishedLot, setTraceFinishedLot] = useState('')
    const [tracedLabels, setTracedLabels] = useState<any[]>([])
    const [isTracingLots, setIsTracingLots] = useState(false)
    const [hasTracedLots, setHasTracedLots] = useState(false)

    // 2. Truy vết ngược (Quét/Nhập QR Tem thùng)
    const [traceCodeInput, setTraceCodeInput] = useState('')
    const [singleTracedLabel, setSingleTracedLabel] = useState<any | null>(null)
    const [isTracingCode, setIsTracingCode] = useState(false)
    const [traceCodeError, setTraceCodeError] = useState('')
    const [hasTracedCode, setHasTracedCode] = useState(false)

    // 3. States cho Modal xem chi tiết dải tem in nhãn
    const [detailModalOpen, setDetailModalOpen] = useState(false)
    const [selectedLogForDetail, setSelectedLogForDetail] = useState<PrintLog | null>(null)
    const [detailLabels, setDetailLabels] = useState<any[]>([])
    const [isLoadingDetail, setIsLoadingDetail] = useState(false)

    // Load danh sách sản phẩm để làm bộ lọc
    useEffect(() => {
        if (!currentSystem?.code) return

        async function fetchProducts() {
            try {
                const { data, error } = await supabase
                    .from('products')
                    .select('id, name, sku, internal_name')
                    .eq('system_code', currentSystem.code)
                    .order('name')

                if (error) throw error
                setProducts(data || [])
            } catch (err: any) {
                console.error('Lỗi khi tải danh sách sản phẩm lọc:', err)
            }
        }

        fetchProducts()
    }, [currentSystem?.code])

    // Load lịch sử in ấn
    const fetchPrintHistory = async (silent = false) => {
        if (!currentSystem?.code) return
        if (!silent) setIsLoading(true)
        else setIsRefreshing(true)

        try {
            let query = supabase
                .from('box_label_print_logs')
                .select(`
                    id,
                    semi_finished_lot_code,
                    finished_lot_code,
                    print_qty,
                    start_index,
                    end_index,
                    created_at,
                    created_by,
                    products (
                        name,
                        sku,
                        internal_name
                    )
                `)
                .eq('system_code', currentSystem.code)
                .order('created_at', { ascending: false })

            // Áp dụng bộ lọc
            if (filterSemiLot.trim()) {
                query = query.ilike('semi_finished_lot_code', `%${filterSemiLot.trim()}%`)
            }
            if (filterFinishedLot.trim()) {
                query = query.ilike('finished_lot_code', `%${filterFinishedLot.trim()}%`)
            }
            if (filterProductId) {
                query = query.eq('product_id', filterProductId)
            }

            // Lọc theo thời gian
            const now = new Date()
            if (filterDateRange === 'today') {
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
                query = query.gte('created_at', startOfDay)
            } else if (filterDateRange === '7days') {
                const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', sevenDaysAgo)
            } else if (filterDateRange === '30days') {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
                query = query.gte('created_at', thirtyDaysAgo)
            }

            const { data, error } = await query

            if (error) {
                if (error.code === '42P01' || error.message?.includes('relation "box_label_print_logs" does not exist')) {
                    throw new Error('TABLE_NOT_EXIST')
                }
                throw error
            }

            setLogs(data as any || [])
            setCurrentPage(1) // Reset về trang 1 khi lọc
        } catch (err: any) {
            console.error('Lỗi khi tải lịch sử in tem:', err)
            if (err.message === 'TABLE_NOT_EXIST') {
                showToast('Bảng sao kê lịch sử chưa được khởi tạo. Hãy chạy migration box_label_print_logs!', 'error')
            } else {
                showToast('Không thể tải lịch sử in: ' + err.message, 'error')
            }
        } finally {
            setIsLoading(false)
            setIsRefreshing(false)
        }
    }

    // Trigger fetch khi thay đổi bộ lọc hoặc hệ thống thay đổi
    useEffect(() => {
        if (activeTab === 'sao-ke') {
            fetchPrintHistory()
        }
    }, [currentSystem?.code, filterSemiLot, filterFinishedLot, filterProductId, filterDateRange, activeTab])

    // ==========================================
    // HÀM XỬ LÝ TRUY VẾT & ĐỊNH VỊ
    // ==========================================
    
    // 1. Truy vết xuôi theo cặp Lô
    const handleTraceLots = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!traceSemiLot.trim() && !traceFinishedLot.trim()) {
            showToast('Vui lòng nhập ít nhất mã Lô BTP hoặc Lô TP để thực hiện truy vết!', 'warning')
            return
        }

        setIsTracingLots(true)
        setHasTracedLots(true)
        setTracedLabels([])

        try {
            let query = supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    semi_finished_lot_code,
                    finished_lot_code,
                    quantity,
                    unit,
                    status,
                    created_at,
                    products ( id, name, sku, internal_name ),
                    lots ( 
                        id, 
                        code, 
                        positions!positions_lot_id_fkey ( code ) 
                    )
                `)
                .eq('system_code', currentSystem?.code || '')

            if (traceSemiLot.trim()) {
                query = query.ilike('semi_finished_lot_code', `%${traceSemiLot.trim()}%`)
            }
            if (traceFinishedLot.trim()) {
                query = query.ilike('finished_lot_code', `%${traceFinishedLot.trim()}%`)
            }

            const { data, error } = await query
            if (error) throw error

            setTracedLabels(data || [])
            showToast(`Đã tìm thấy ${data?.length || 0} thùng tem khớp điều kiện truy vết.`, 'success')
        } catch (err: any) {
            console.error('Lỗi khi truy vết danh sách Lô:', err)
            showToast('Lỗi truy vết Lô: ' + err.message, 'error')
        } finally {
            setIsTracingLots(false)
        }
    }

    // 2. Truy vết ngược theo mã tem quét
    const handleTraceCode = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!traceCodeInput.trim()) return

        setIsTracingCode(true)
        setTraceCodeError('')
        setSingleTracedLabel(null)
        setHasTracedCode(true)

        try {
            const inputVal = traceCodeInput.trim().toUpperCase()

            // Thực hiện câu select join an toàn chỉ định rõ FK positions_lot_id_fkey
            const { data, error } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    semi_finished_lot_code,
                    finished_lot_code,
                    quantity,
                    unit,
                    status,
                    created_at,
                    products ( id, name, sku, internal_name ),
                    lots ( 
                        id, 
                        code, 
                        positions!positions_lot_id_fkey ( code ) 
                    )
                `)
                .eq('code', inputVal)
                .eq('system_code', currentSystem?.code || '')
                .maybeSingle()

            if (error) throw error

            if (!data) {
                setTraceCodeError(`Không tìm thấy dữ liệu truy vết cho mã tem "${inputVal}" trong phân hệ kho hiện hành.`)
            } else {
                setSingleTracedLabel(data)
            }
        } catch (err: any) {
            console.error('Lỗi khi truy vết mã tem đơn lẻ:', err)
            setTraceCodeError('Lỗi truy vấn cơ sở dữ liệu: ' + err.message)
        } finally {
            setIsTracingCode(false)
        }
    }

    // ==========================================
    // HÀM TRUY XUẤT CHI TIẾT DẢI TEM IN REAL-TIME
    // ==========================================
    const handleOpenLabelDetailModal = async (log: PrintLog) => {
        setSelectedLogForDetail(log)
        setDetailModalOpen(true)
        setDetailLabels([])
        setIsLoadingDetail(true)

        try {
            // 1. Sinh danh sách mã tem từ dải index
            const cleanLotCode = log.finished_lot_code.replace(/\s+/g, '').toUpperCase()
            const cleanSemiCode = log.semi_finished_lot_code.replace(/\s+/g, '').toUpperCase()
            const productSku = log.products ? log.products.sku : '---'
            const cleanSku = (productSku && productSku !== '---' ? productSku : 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

            const generatedCodes: string[] = []
            for (let i = log.start_index; i <= log.end_index; i++) {
                const indexStr = String(i).padStart(3, '0')
                generatedCodes.push(`BOX-${cleanLotCode}-${cleanSemiCode}-${cleanSku}-${indexStr}`)
            }

            if (generatedCodes.length === 0) {
                setIsLoadingDetail(false)
                return
            }

            // 2. Truy vấn Supabase tìm thông tin các con tem này trong bảng box_labels
            const { data, error } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    quantity,
                    unit,
                    lot_id,
                    status,
                    lots (
                        id,
                        code
                    )
                `)
                .in('code', generatedCodes)

            if (error) throw error

            // Tạo map từ code sang dữ liệu tem DB để giữ đúng thứ tự dải tăng dần
            const labelMap = new Map<string, any>()
            data?.forEach(item => {
                labelMap.set(item.code, item)
            })

            // Xây dựng danh sách tem hiển thị theo thứ tự index dải in
            const orderedLabels = generatedCodes.map((code, index) => {
                const seq = log.start_index + index
                const labelInDb = labelMap.get(code)
                return {
                    seq,
                    code,
                    foundInDb: !!labelInDb,
                    quantity: labelInDb?.quantity || 10,
                    unit: labelInDb?.unit || 'Kg',
                    lot_id: labelInDb?.lot_id || null,
                    lots: labelInDb?.lots || null,
                    status: labelInDb?.status || 'printed'
                }
            })

            setDetailLabels(orderedLabels)
        } catch (err: any) {
            console.error('Lỗi khi tải chi tiết dải tem:', err)
            showToast('Không thể tải chi tiết dải tem: ' + err.message, 'error')
        } finally {
            setIsLoadingDetail(false)
        }
    }

    // Tính toán phân trang cho Tab 1
    const totalItems = logs.length
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const paginatedLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

    const getLabelRangeStr = (log: PrintLog) => {
        const cleanLotCode = log.finished_lot_code.replace(/\s+/g, '').toUpperCase()
        const cleanSemiCode = log.semi_finished_lot_code.replace(/\s+/g, '').toUpperCase()
        const productSku = log.products ? log.products.sku : '---'
        const cleanSku = (productSku && productSku !== '---' ? productSku : 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
        
        const startStr = String(log.start_index).padStart(3, '0')
        const endStr = String(log.end_index).padStart(3, '0')
        return `BOX-${cleanLotCode}-${cleanSemiCode}-${cleanSku}-${startStr} → BOX-${cleanLotCode}-${cleanSemiCode}-${cleanSku}-${endStr}`
    }

    const formatDateTime = (dateStr: string) => {
        const d = new Date(dateStr)
        return d.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
    }

    return (
        <section className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-stone-900 dark:text-stone-100 tracking-tight flex items-center gap-2.5">
                        <History className="text-emerald-600" size={28} />
                        Trạm Đối Soát & Truy Vết Thùng Hàng
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1 text-sm md:text-base">
                        Sao kê dải tem phát hành, quét tem đối soát thùng hàng xếp Pallet và định vị vị trí kho.
                    </p>
                </div>
                
                {activeTab === 'sao-ke' && (
                    <button
                        onClick={() => fetchPrintHistory(true)}
                        disabled={isRefreshing || isLoading}
                        className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                        <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                        Làm mới sao kê
                    </button>
                )}
            </div>

            {/* Tab Switcher - Premium Pills design */}
            <div className="flex items-center p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-2xl max-w-md shadow-inner border border-stone-200/20">
                <button
                    onClick={() => setActiveTab('sao-ke')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                        activeTab === 'sao-ke'
                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-stone-200/10'
                            : 'text-stone-500 hover:text-stone-850 dark:text-stone-400'
                    }`}
                >
                    <FileText size={14} />
                    Sao Kê Lịch Sử In
                </button>
                <button
                    onClick={() => setActiveTab('truy-vet')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-black tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                        activeTab === 'truy-vet'
                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-stone-200/10'
                            : 'text-stone-500 hover:text-stone-850 dark:text-stone-400'
                    }`}
                >
                    <QrCode size={14} />
                    Truy Vết & Định Vị
                </button>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: SAO KÊ LỊCH SỬ IN TEM */}
            {/* ============================================================== */}
            {activeTab === 'sao-ke' && (
                <>
                    {/* Bảng Bộ Lọc */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 border-b border-stone-100 dark:border-zinc-800 pb-2">
                            <Search className="text-stone-400" size={16} />
                            <h3 className="font-bold text-sm text-stone-700 dark:text-stone-300 uppercase tracking-wider">Bộ lọc đối soát sao kê</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                    <Boxes size={10} />
                                    Mã Lô BTP
                                </label>
                                <input
                                    type="text"
                                    value={filterSemiLot}
                                    onChange={(e) => setFilterSemiLot(e.target.value)}
                                    placeholder="Nhập mã lô BTP..."
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono uppercase"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                    <Package size={10} />
                                    Mã Lô Thành Phẩm
                                </label>
                                <input
                                    type="text"
                                    value={filterFinishedLot}
                                    onChange={(e) => setFilterFinishedLot(e.target.value)}
                                    placeholder="Nhập mã lô TP..."
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono uppercase"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                    <Tag size={10} />
                                    Sản phẩm đầu ra
                                </label>
                                <select
                                    value={filterProductId}
                                    onChange={(e) => setFilterProductId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                                >
                                    <option value="">-- Tất cả sản phẩm --</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.internal_name || p.name} ({p.sku})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                    <Calendar size={10} />
                                    Thời gian in
                                </label>
                                <select
                                    value={filterDateRange}
                                    onChange={(e) => setFilterDateRange(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-800 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
                                >
                                    <option value="all">Tất cả thời gian</option>
                                    <option value="today">Hôm nay</option>
                                    <option value="7days">7 ngày gần đây</option>
                                    <option value="30days">30 ngày gần đây</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách dữ liệu sao kê */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                <RefreshCw className="text-emerald-500 animate-spin" size={32} />
                                <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Đang tải lịch sử sao kê...</p>
                            </div>
                        ) : logs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/20 text-[10px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase">
                                            <th className="px-6 py-4">Thời gian in</th>
                                            <th className="px-6 py-4">Lô Bán Thành Phẩm (BTP)</th>
                                            <th className="px-6 py-4">Lô Thành Phẩm (TP)</th>
                                            <th className="px-6 py-4">Sản Phẩm</th>
                                            <th className="px-6 py-4 text-center">Số lượng tem</th>
                                            <th className="px-6 py-4 text-center">Dải tem phát hành</th>
                                            <th className="px-6 py-4"><span className="flex items-center gap-1"><User size={10} /> Người in</span></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800 text-xs">
                                        {paginatedLogs.map((log) => {
                                            const productName = log.products 
                                                ? (log.products.internal_name || log.products.name)
                                                : 'Sản phẩm không rõ'
                                            const productSku = log.products ? log.products.sku : '---'

                                            const cleanLotCode = log.finished_lot_code.replace(/\s+/g, '').toUpperCase()
                                            const cleanSemiCode = log.semi_finished_lot_code.replace(/\s+/g, '').toUpperCase()
                                            const cleanSku = (productSku && productSku !== '---' ? productSku : 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                            
                                            const startStr = String(log.start_index).padStart(3, '0')
                                            const endStr = String(log.end_index).padStart(3, '0')
                                            const labelRangeStr = `BOX-${cleanLotCode}-${cleanSemiCode}-${cleanSku}-${startStr} → BOX-${cleanLotCode}-${cleanSemiCode}-${cleanSku}-${endStr}`

                                            return (
                                                <tr key={log.id} className="hover:bg-stone-50/30 dark:hover:bg-zinc-800/10 transition-colors">
                                                    <td className="px-6 py-4 text-stone-500 dark:text-stone-400 font-mono whitespace-nowrap">
                                                        {formatDateTime(log.created_at)}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono font-bold text-stone-800 dark:text-zinc-200 uppercase">
                                                        {log.semi_finished_lot_code}
                                                    </td>
                                                    <td className="px-6 py-4 font-mono font-bold text-stone-800 dark:text-zinc-200 uppercase">
                                                        {log.finished_lot_code}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-semibold text-stone-900 dark:text-white uppercase leading-normal">
                                                            {productName}
                                                        </div>
                                                        <div className="text-[10px] text-stone-400 font-mono mt-0.5">{productSku}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold text-stone-900 dark:text-white tabular-nums bg-stone-50/20 dark:bg-zinc-800/10">
                                                        {log.print_qty}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenLabelDetailModal(log)}
                                                            className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-450 border border-emerald-500/10 hover:border-emerald-500/20 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm mx-auto"
                                                            title="Xem danh sách tem chi tiết"
                                                        >
                                                            <Eye size={14} />
                                                            <span>Xem dải tem ({log.print_qty})</span>
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-stone-500 dark:text-stone-400 truncate max-w-[120px]" title={log.created_by || ''}>
                                                        {log.created_by ? log.created_by.slice(0, 8) + '...' : 'Hệ thống'}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-16 text-center space-y-3">
                                <FileText className="text-stone-300 dark:text-zinc-700" size={48} />
                                <div>
                                    <h4 className="font-bold text-stone-700 dark:text-zinc-300">Không tìm thấy dữ liệu in tem</h4>
                                    <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-sm">
                                        Chưa có lượt in tem trùng với các điều kiện lọc hiện hành. Thử thay đổi bộ lọc hoặc in nhãn tem mới tại Trạm In Tem.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Phân Trang */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between border-t border-stone-100 dark:border-zinc-800 px-6 py-4 bg-stone-50/30 dark:bg-zinc-800/10 text-xs">
                                <div className="text-stone-500 dark:text-stone-400">
                                    Hiển thị từ <span className="font-bold text-stone-800 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> đến <span className="font-bold text-stone-800 dark:text-white">{Math.min(currentPage * itemsPerPage, totalItems)}</span> trong tổng số <span className="font-bold text-stone-800 dark:text-white">{totalItems}</span> bản ghi sao kê
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-400 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        <ChevronLeft size={14} />
                                    </button>
                                    <span className="font-bold text-stone-800 dark:text-white tabular-nums">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-400 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ============================================================== */}
            {/* TAB 2: TRUY VẾT & ĐỊNH VỊ THÙNG HÀNG */}
            {/* ============================================================== */}
            {activeTab === 'truy-vet' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* BẢN BỘ LỌC VÀ CÔNG CỤ TRUY VẾT (Bên trái: 4/12 cols) */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        {/* Phần A: Bộ quét QR tem thùng (Truy vết ngược) */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                                <ScanLine className="text-orange-600" size={18} />
                                <h3 className="font-bold text-sm text-stone-800 dark:text-stone-250 uppercase tracking-wider">Quét / Tra cứu tem thùng</h3>
                            </div>
                            
                            <form onSubmit={handleTraceCode} className="space-y-3">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                                        Nhập / Quét mã QR tem thùng hàng (BOX-...)
                                    </label>
                                    <div className="relative">
                                        <QrCode className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                                        <input
                                            type="text"
                                            value={traceCodeInput}
                                            onChange={(e) => setTraceCodeInput(e.target.value)}
                                            placeholder="Quét mã QR tại đây..."
                                            disabled={isTracingCode}
                                            className="w-full pl-9 pr-4 py-2.5 bg-stone-50/50 dark:bg-zinc-800/40 border border-stone-250 dark:border-zinc-700 rounded-2xl text-xs font-mono transition-all outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 uppercase placeholder:font-sans"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={isTracingCode || !traceCodeInput.trim()}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all active:scale-95 shadow-md shadow-orange-500/10 cursor-pointer"
                                >
                                    {isTracingCode ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            Đang tra cứu...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={14} />
                                            Tra cứu ngược
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Phần B: Truy vết theo Lô sản xuất (Truy vết xuôi) */}
                        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-4">
                            <div className="flex items-center gap-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                                <Boxes className="text-emerald-600" size={18} />
                                <h3 className="font-bold text-sm text-stone-800 dark:text-stone-250 uppercase tracking-wider">Truy vết xuôi theo Lô</h3>
                            </div>
                            
                            <form onSubmit={handleTraceLots} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                        <Boxes size={10} />
                                        Mã Lô Bán Thành Phẩm (BTP)
                                    </label>
                                    <input
                                        type="text"
                                        value={traceSemiLot}
                                        onChange={(e) => setTraceSemiLot(e.target.value)}
                                        placeholder="Nhập mã Lô BTP cần tra..."
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-850 dark:text-white font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500 flex items-center gap-1">
                                        <Package size={10} />
                                        Mã Lô Thành Phẩm (TP)
                                    </label>
                                    <input
                                        type="text"
                                        value={traceFinishedLot}
                                        onChange={(e) => setTraceFinishedLot(e.target.value)}
                                        placeholder="Nhập mã Lô TP cần tra..."
                                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/50 dark:bg-zinc-800/50 text-stone-850 dark:text-white font-mono uppercase focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isTracingLots || (!traceSemiLot.trim() && !traceFinishedLot.trim())}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl transition-all active:scale-95 shadow-md shadow-emerald-500/10 cursor-pointer"
                                >
                                    {isTracingLots ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            Đang truy xuất...
                                        </>
                                    ) : (
                                        <>
                                            <Activity size={14} />
                                            Bắt đầu truy vết
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* KHU VỰC HIỂN THỊ KẾT QUẢ TRUY VẾT (Bên phải: 8/12 cols) */}
                    <div className="lg:col-span-8">
                        
                        {/* 1. Nếu có kết quả tra cứu ngược Tem Đơn lẻ */}
                        {hasTracedCode && (
                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-6">
                                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <Box className="text-orange-500" size={20} />
                                        <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">Hồ Sơ Thùng Hàng (Box Label Passport)</h3>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full border border-orange-500/10 shadow-sm animate-pulse">
                                        Chế độ quét trực quan
                                    </span>
                                </div>

                                {isTracingCode ? (
                                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                        <RefreshCw className="text-orange-500 animate-spin" size={32} />
                                        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Đang phân tích cấu trúc dữ liệu thùng...</p>
                                    </div>
                                ) : traceCodeError ? (
                                    <div className="p-5 bg-red-50 dark:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 rounded-2xl text-center text-red-600 dark:text-red-400 text-xs font-semibold">
                                        ❌ {traceCodeError}
                                    </div>
                                ) : singleTracedLabel ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        
                                        {/* Cột trái lý lịch: Nguồn gốc xuất xứ */}
                                        <div className="space-y-4 bg-stone-50/50 dark:bg-zinc-800/20 p-5 rounded-2xl border border-stone-100 dark:border-zinc-800/40">
                                            <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-bold text-xs uppercase tracking-wider pb-1 border-b border-stone-200/40 dark:border-zinc-800/50">
                                                <ShieldCheck size={14} className="text-emerald-500" />
                                                Thông tin xuất xứ nguồn gốc
                                            </div>
                                            
                                            <div className="space-y-3 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Mã tem thùng:</span>
                                                    <span className="font-mono font-bold text-stone-850 dark:text-white bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-stone-200/40 dark:border-zinc-700/50 shadow-sm uppercase">{singleTracedLabel.code}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Sản phẩm đầu ra:</span>
                                                    <span className="font-bold text-stone-900 dark:text-white text-right max-w-[200px] truncate uppercase" title={singleTracedLabel.products ? (singleTracedLabel.products.internal_name || singleTracedLabel.products.name) : 'N/A'}>
                                                        {singleTracedLabel.products ? (singleTracedLabel.products.internal_name || singleTracedLabel.products.name) : '---'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Mã SKU:</span>
                                                    <span className="font-mono font-bold text-stone-850 dark:text-zinc-300">{singleTracedLabel.products?.sku || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Lô bán thành phẩm (BTP):</span>
                                                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-400/5 px-2 py-0.5 rounded-md border border-emerald-500/10 uppercase">{singleTracedLabel.semi_finished_lot_code || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Lô thành phẩm (TP):</span>
                                                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-400/5 px-2 py-0.5 rounded-md border border-emerald-500/10 uppercase">{singleTracedLabel.finished_lot_code || '---'}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Trọng lượng thùng:</span>
                                                    <span className="font-bold text-stone-900 dark:text-white tabular-nums bg-stone-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-lg">{singleTracedLabel.quantity} {singleTracedLabel.unit}</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-stone-400 dark:text-stone-500 font-medium">Thời điểm phát hành:</span>
                                                    <span className="font-mono text-stone-500 dark:text-stone-400 text-right">{formatDateTime(singleTracedLabel.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cột phải lý lịch: Vị trí & Định vị kho */}
                                        <div className="space-y-4 bg-stone-50/50 dark:bg-zinc-800/20 p-5 rounded-2xl border border-stone-100 dark:border-zinc-800/40 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300 font-bold text-xs uppercase tracking-wider pb-1 border-b border-stone-200/40 dark:border-zinc-800/50 mb-4">
                                                    <MapPin size={14} className="text-orange-500" />
                                                    Định vị vật lý trong kho
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200/30 dark:border-zinc-700 shadow-sm text-stone-500 shrink-0">
                                                            <Package size={18} />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[10px] font-bold text-stone-450 dark:text-stone-500 uppercase tracking-wider">Pallet chứa hàng (LOT)</div>
                                                            <div className="font-mono text-sm font-black text-stone-900 dark:text-white uppercase leading-normal">
                                                                {singleTracedLabel.lots?.code ? (
                                                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                                        {singleTracedLabel.lots.code}
                                                                        <ExternalLink size={12} className="opacity-70" />
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-stone-400 dark:text-stone-500 font-medium italic">Thùng hàng chưa xếp lên Pallet</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-3">
                                                        <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-stone-200/30 dark:border-zinc-700 shadow-sm text-stone-500 shrink-0">
                                                            <MapPin size={18} />
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            <div className="text-[10px] font-bold text-stone-450 dark:text-stone-500 uppercase tracking-wider">Vị trí lưu kho (Position)</div>
                                                            <div className="font-mono text-sm font-black text-stone-900 dark:text-white uppercase leading-normal">
                                                                {singleTracedLabel.lots?.positions && singleTracedLabel.lots.positions.length > 0 ? (
                                                                    <span className="text-orange-600 dark:text-orange-400 bg-orange-500/5 dark:bg-orange-400/5 px-2 py-0.5 rounded-lg border border-orange-500/10">
                                                                        {singleTracedLabel.lots.positions[0].code}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-stone-400 dark:text-stone-500 font-medium italic">Pallet chưa được xếp vào vị trí kho</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Badge trạng thái thùng */}
                                            <div className="pt-4 border-t border-stone-250/20 dark:border-zinc-800 flex items-center justify-between text-xs">
                                                <span className="text-stone-450 dark:text-stone-500 font-medium">Trạng thái thùng:</span>
                                                {singleTracedLabel.status === 'linked' ? (
                                                    <span className="font-bold text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-450 bg-emerald-100 dark:bg-emerald-950/20 px-3 py-1 rounded-full border border-emerald-500/20">
                                                        Đã xếp Pallet & Định vị vị trí
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-[10px] uppercase tracking-wider text-orange-700 dark:text-orange-450 bg-orange-100 dark:bg-orange-950/20 px-3 py-1 rounded-full border border-orange-500/20 animate-pulse">
                                                        Mới in - Chưa xếp lên Pallet
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-stone-400 dark:text-stone-500 text-xs">
                                        Nhập hoặc quét mã QR tem thùng hàng bên trái để xem lý lịch chi tiết.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. Nếu có kết quả tra cứu xuôi danh sách Tem theo Lô */}
                        {hasTracedLots && !hasTracedCode && (
                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                                    <div className="flex items-center gap-2">
                                        <Boxes className="text-emerald-600" size={20} />
                                        <h3 className="font-bold text-sm text-stone-800 dark:text-stone-100">Danh sách Tem thùng hàng theo Lô</h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-zinc-800 px-3 py-1 rounded-xl shadow-inner border border-stone-200/10">
                                        Tổng cộng: {tracedLabels.length} tem thùng
                                    </span>
                                </div>

                                {isTracingLots ? (
                                    <div className="flex flex-col items-center justify-center p-20 space-y-4">
                                        <RefreshCw className="text-emerald-500 animate-spin" size={32} />
                                        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">Đang dò quét cơ sở dữ liệu dải tem...</p>
                                    </div>
                                ) : tracedLabels.length > 0 ? (
                                    <div className="overflow-x-auto border border-stone-100 dark:border-zinc-800 rounded-2xl">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-800/20 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase">
                                                    <th className="px-4 py-3">Mã tem thùng (BOX-)</th>
                                                    <th className="px-4 py-3">Sản phẩm</th>
                                                    <th className="px-4 py-3 text-right">Trọng lượng</th>
                                                    <th className="px-4 py-3 text-center">Trạng thái xếp</th>
                                                    <th className="px-4 py-3">Pallet chứa</th>
                                                    <th className="px-4 py-3">Vị trí kho</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                {tracedLabels.map((label, idx) => {
                                                    const prodName = label.products 
                                                        ? (label.products.internal_name || label.products.name)
                                                        : 'Sản phẩm không rõ'
                                                    const prodSku = label.products ? label.products.sku : '---'

                                                    return (
                                                        <tr key={label.id || idx} className="hover:bg-stone-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                                                            <td className="px-4 py-3 font-mono font-bold text-stone-900 dark:text-zinc-100 uppercase">
                                                                {label.code}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="font-semibold text-stone-950 dark:text-white truncate max-w-[150px] uppercase">
                                                                    {prodName}
                                                                </div>
                                                                <div className="text-[9px] text-stone-400 font-mono mt-0.5 leading-none">{prodSku}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-zinc-200 tabular-nums">
                                                                {label.quantity} {label.unit}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {label.status === 'linked' ? (
                                                                    <span className="font-bold text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-450/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                                                                        Đã xếp
                                                                    </span>
                                                                ) : (
                                                                    <span className="font-bold text-[9px] uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-500/5 dark:bg-orange-450/5 px-2 py-0.5 rounded-full border border-orange-500/10">
                                                                        Chưa xếp
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-stone-700 dark:text-zinc-300 font-semibold uppercase">
                                                                {label.lots?.code || '---'}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {label.lots?.positions && label.lots.positions.length > 0 ? (
                                                                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400 bg-orange-500/5 dark:bg-orange-455/5 px-2 py-0.5 rounded-md border border-orange-500/10 text-[10px]">
                                                                        {label.lots.positions[0].code}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-stone-400 dark:text-stone-500 italic">---</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-16 text-center space-y-2">
                                        <Boxes className="text-stone-300 dark:text-zinc-700 mx-auto" size={32} />
                                        <div>
                                            <h5 className="text-xs font-bold text-stone-700 dark:text-zinc-300">Không tìm thấy tem nào</h5>
                                            <p className="text-[10px] text-stone-400 dark:text-zinc-550 max-w-xs mx-auto">
                                                Cặp Lô BTP và TP bạn chọn hiện tại chưa được tạo bất kỳ tem thùng hàng nào trong phân hệ.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. Mặc định chưa có lượt tra cứu nào */}
                        {!hasTracedLots && !hasTracedCode && (
                            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800/80 rounded-3xl p-16 text-center space-y-4 shadow-sm">
                                <QrCode className="text-stone-200 dark:text-zinc-700 mx-auto animate-pulse" size={64} />
                                <div className="space-y-1">
                                    <h4 className="font-black text-sm text-stone-700 dark:text-stone-300 uppercase tracking-wider">Trạm Truy Vết Thông Tin Hoạt Động</h4>
                                    <p className="text-xs text-stone-400 dark:text-stone-500 max-w-sm mx-auto leading-relaxed">
                                        Sử dụng các công cụ tra cứu ở bên trái để truy xuất nguồn gốc tem thùng (Xuôi) hoặc lý lịch của một con tem cụ thể (Ngược).
                                    </p>
                                </div>
                            </div>
                        )}

                    </div>

                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL POPUP XEM CHI TIẾT DANH SÁCH TEM TRONG DẢI IN */}
            {/* ============================================================== */}
            {detailModalOpen && selectedLogForDetail && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-stone-50 dark:bg-zinc-800/40 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                                    <QrCode className="text-emerald-600 animate-pulse" size={20} />
                                    Danh Sách Chi Tiết Dải Tem
                                </h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 font-mono">
                                    {selectedLogForDetail.products ? (selectedLogForDetail.products.internal_name || selectedLogForDetail.products.name) : 'Sản phẩm'} | Lô TP: {selectedLogForDetail.finished_lot_code}
                                </p>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold bg-emerald-500/5 dark:bg-emerald-450/10 px-2 py-0.5 rounded border border-emerald-500/10 mt-1.5 inline-block">
                                    Dải tem: {getLabelRangeStr(selectedLogForDetail)}
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setDetailModalOpen(false)
                                    setSelectedLogForDetail(null)
                                    setDetailLabels([])
                                }}
                                className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-4">
                            {isLoadingDetail ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-3">
                                    <RefreshCw className="text-emerald-500 animate-spin" size={28} />
                                    <p className="text-xs font-semibold text-stone-500">Đang truy xuất thông tin chi tiết tem từ DB...</p>
                                </div>
                            ) : detailLabels.length > 0 ? (
                                <div className="border border-stone-150 dark:border-zinc-800 rounded-2xl overflow-hidden bg-stone-50/10 dark:bg-zinc-900/20">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-stone-150 dark:border-zinc-800 bg-stone-100/50 dark:bg-zinc-800/30 text-[9px] font-black tracking-widest text-stone-400 dark:text-stone-500 uppercase">
                                                <th className="px-4 py-3 text-center w-16">STT</th>
                                                <th className="px-4 py-3">Mã tem thùng</th>
                                                <th className="px-4 py-3 text-center">Trạng thái gắn Pallet</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-150/40 dark:divide-zinc-800/50">
                                            {detailLabels.map((label) => (
                                                <tr key={label.code} className="hover:bg-stone-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                                                    <td className="px-4 py-3 text-center font-bold text-stone-400 tabular-nums">
                                                        #{label.seq}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-stone-850 dark:text-zinc-100 uppercase">
                                                        {label.code}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {label.lot_id && label.lots ? (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/10 text-[10px] font-bold">
                                                                <Boxes size={12} />
                                                                Đã xếp Pallet: <span className="font-mono uppercase">{label.lots.code}</span>
                                                            </div>
                                                        ) : label.foundInDb ? (
                                                            <span className="inline-block px-2.5 py-1 bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-stone-400 rounded-full border border-stone-200/40 dark:border-zinc-700/50 text-[10px] font-semibold">
                                                                Chưa xếp Pallet
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-2.5 py-1 bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-450 rounded-full border border-red-500/10 text-[10px] font-semibold">
                                                                Chưa đồng bộ DB
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-stone-400 text-xs font-semibold">
                                    Không thể tạo danh sách tem chi tiết.
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-stone-50 dark:bg-zinc-800/40 border-t border-stone-100 dark:border-zinc-800 flex justify-end">
                            <button
                                onClick={() => {
                                    setDetailModalOpen(false)
                                    setSelectedLogForDetail(null)
                                    setDetailLabels([])
                                }}
                                className="px-5 py-2 bg-stone-200 hover:bg-stone-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </section>
    )
}
