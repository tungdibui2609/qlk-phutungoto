'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
    BarChart3, 
    Search, 
    Download, 
    Calendar, 
    Users, 
    Package, 
    Filter, 
    ChevronDown, 
    ArrowUpRight,
    Loader2,
    CalendarDays,
    Clock,
    User,
    ClipboardList,
    TrendingUp
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatQuantityFull } from '@/lib/numberUtils'
import { format } from 'date-fns'

type PickRecord = {
    id: string
    task_item_id: string
    quantity: number
    note: string | null
    picker_id: string
    session_id: string | null
    system_code: string
    created_at: string
    // Joined data
    picker: { username: string; full_name: string | null } | null
    task_item: {
        task_id: string
        product_id: string
        unit: string | null
        products: { name: string; sku: string } | null
        export_tasks: { code: string } | null
    } | null
}

export default function PickingProductivityPage() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [picks, setPicks] = useState<PickRecord[]>([])
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(new Date().getDate() - 7)), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
    const [pickerFilter, setPickerFilter] = useState('all')
    const [pickers, setPickers] = useState<{id: string, name: string}[]>([])

    useEffect(() => {
        if (currentSystem?.code) {
            fetchPickers()
            fetchData()
        }
    }, [currentSystem, dateFrom, dateTo, pickerFilter])

    async function fetchPickers() {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('id, username, full_name')
            .order('username')
        if (!error && data) {
            setPickers((data as any[]).map(p => ({ 
                id: p.id, 
                name: p.full_name || p.username 
            })))
        }
    }

    async function fetchData() {
        setLoading(true)
        try {
            let query = supabase
                .from('export_task_picks')
                .select(`
                    *,
                    picker:user_profiles!picker_id(username, full_name),
                    task_item:export_task_items!task_item_id(
                        task_id,
                        product_id,
                        unit,
                        products(name, sku),
                        export_tasks(code)
                    )
                `)
                .eq('system_code', currentSystem?.code || '')
                .gte('created_at', `${dateFrom}T00:00:00`)
                .lte('created_at', `${dateTo}T23:59:59`)
                .order('created_at', { ascending: false })

            if (pickerFilter !== 'all') {
                query = query.eq('picker_id', pickerFilter)
            }

            const { data, error } = await query
            if (error) throw error
            setPicks((data as any[]) as PickRecord[])
        } catch (error: any) {
            showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const filteredPicks = picks.filter(p => {
        const searchLower = searchTerm.toLowerCase()
        return (
            p.task_item?.products?.name?.toLowerCase().includes(searchLower) ||
            p.task_item?.products?.sku?.toLowerCase().includes(searchLower) ||
            p.task_item?.export_tasks?.code?.toLowerCase().includes(searchLower) ||
            p.picker?.username?.toLowerCase().includes(searchLower) ||
            (p.picker?.full_name?.toLowerCase().includes(searchLower) ?? false)
        )
    })

    // Stats calculations
    const stats = {
        totalQty: filteredPicks.reduce((sum, p) => sum + (p.quantity || 0), 0),
        totalSessions: new Set(filteredPicks.map(p => p.session_id)).size,
        uniqueProducts: new Set(filteredPicks.map(p => p.task_item?.product_id)).size,
        topPicker: (() => {
            const counts: Record<string, number> = {}
            filteredPicks.forEach(p => {
                const name = p.picker?.full_name || p.picker?.username || 'N/A'
                counts[name] = (counts[name] || 0) + (p.quantity || 0)
            })
            return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
        })()
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm">
                            <BarChart3 size={24} strokeWidth={2.5} />
                        </div>
                        Năng suất lấy hàng
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11">
                        Theo dõi sản lượng và hiệu quả làm việc của đội ngũ nhân viên lấy hàng.
                    </p>
                </div>

                <button
                    onClick={() => { window.print() }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/20 w-fit"
                >
                    <Download size={18} />
                    Xuất báo cáo
                </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Tổng sản lượng', value: formatQuantityFull(stats.totalQty), icon: Package, color: 'blue' },
                    { label: 'Số lượt lấy', value: stats.totalSessions, icon: ClipboardList, color: 'orange' },
                    { label: 'Số mặt hàng', value: stats.uniqueProducts, icon: TrendingUp, color: 'emerald' },
                    { label: 'Nhân viên top', value: stats.topPicker, icon: Users, color: 'purple' },
                ].map((s, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
                        <div className={`p-3 rounded-xl bg-${s.color}-100 dark:bg-${s.color}-900/20 text-${s.color}-600 dark:text-${s.color}-400`}>
                            <s.icon size={20} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">{s.label}</p>
                            <p className="text-lg font-black text-stone-900 dark:text-white truncate max-w-[140px]">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm sản phẩm, SKU, mã lệnh..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    />
                </div>

                <div className="relative group">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium appearance-none"
                    />
                </div>

                <div className="relative group">
                    <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium appearance-none"
                    />
                </div>

                <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <select
                        value={pickerFilter}
                        onChange={(e) => setPickerFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
                    >
                        <option value="all">Tất cả nhân viên</option>
                        {pickers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <ClipboardList size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 whitespace-nowrap">Kết quả: {filteredPicks.length}</span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center justify-center">
                            <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                            <p className="text-stone-500 font-medium">Đang truy xuất lịch sử...</p>
                        </div>
                    ) : filteredPicks.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="p-4 bg-stone-50 dark:bg-slate-800 rounded-full mb-4 text-stone-200">
                                <Package size={48} />
                            </div>
                            <p className="text-stone-500 font-medium">Không tìm thấy dữ liệu trong khoảng thời gian này</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-700">
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Thời gian</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Nhân viên</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Sản phẩm</th>
                                    <th className="text-center px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Số lượng</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Mã lệnh</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Ghi chú</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredPicks.map(p => (
                                    <tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-stone-400" />
                                                    {format(new Date(p.created_at), 'dd/MM/yyyy')}
                                                </span>
                                                <span className="text-[10px] text-stone-400 font-medium tracking-tight ml-4.5 flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {format(new Date(p.created_at), 'HH:mm')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-slate-800 flex items-center justify-center text-stone-500 font-bold text-xs border border-stone-200 dark:border-slate-700 uppercase">
                                                    {(p.picker?.full_name || p.picker?.username || '?').substring(0, 2)}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-stone-900 dark:text-stone-100">
                                                        {p.picker?.full_name || p.picker?.username}
                                                    </span>
                                                    <span className="text-[10px] text-stone-400">@{p.picker?.username}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 min-w-[200px]">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-stone-900 dark:text-stone-100 line-clamp-1" title={p.task_item?.products?.name}>
                                                    {p.task_item?.products?.name}
                                                </span>
                                                <span className="px-1.5 py-0.5 mt-1 bg-stone-100 dark:bg-slate-800 text-stone-500 dark:text-stone-400 rounded text-[9px] font-bold border border-stone-200 dark:border-slate-700 w-fit uppercase tracking-tighter">
                                                    {p.task_item?.products?.sku}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span className="text-base font-black text-blue-600 dark:text-blue-500 tabular-nums">
                                                    {formatQuantityFull(p.quantity)}
                                                </span>
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                                    {p.task_item?.unit || 'Đơn vị'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-black border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter shadow-sm">
                                                {p.task_item?.export_tasks?.code || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-stone-500 italic max-w-[150px] block truncate">
                                                {p.note || '-'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
