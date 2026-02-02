'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { History, Search, Download, Calendar, Boxes, ArrowRightLeft, Building2, ChevronDown, Link as LinkIcon, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import Link from 'next/link'

type LinkedEntry = {
    id: string; // ID of the history entry
    lot_id: string;
    lot_code: string;
    date: string;
    type: 'Inbound' | 'Export';
    items: any[];
    quantity: number;
    unit: string;
    order_id: string | null;
    order_code: string | null;
    is_adjustment: boolean;
    description: string;
    customer_supplier: string;
}

export default function LinkedJournalPage() {
    const [entries, setEntries] = useState<LinkedEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'Inbound' | 'Export'>('all')
    const { systemType } = useSystem()

    useEffect(() => {
        fetchData()
    }, [systemType])

    async function fetchData() {
        setLoading(true)
        const { data: lots, error } = await supabase
            .from('lots')
            .select(`
                id,
                code,
                metadata,
                lot_items (
                    id,
                    quantity,
                    products (name, sku, unit)
                )
            `)
            .eq('system_code', systemType)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching data:', error)
            setLoading(false)
            return
        }

        const allEntries: LinkedEntry[] = []

        lots?.forEach(lot => {
            const history = (lot.metadata as any)?.system_history || {}

            const processEntries = (list: any[], type: 'Inbound' | 'Export') => {
                if (!Array.isArray(list)) return
                list.forEach((entry: any) => {
                    const items = Object.values(entry.items || {})
                    const totalQty = items.reduce((sum: number, item: any) =>
                        sum + (type === 'Inbound' ? (item.quantity || 0) : (item.exported_quantity || 0)), 0)
                    const unit = items[0] ? (items[0] as any).unit : 'N/A'

                    allEntries.push({
                        id: entry.id,
                        lot_id: lot.id,
                        lot_code: lot.code,
                        date: entry.date,
                        type: type,
                        items: items,
                        quantity: totalQty,
                        unit: unit,
                        order_id: entry.order_id || null,
                        order_code: entry.order_code || null,
                        is_adjustment: !!entry.is_adjustment,
                        description: entry.description || (type === 'Inbound' ? 'Nhập kho' : 'Xuất kho'),
                        customer_supplier: type === 'Inbound' ? (entry.supplier_name || 'N/A') : (entry.customer || 'N/A')
                    })
                })
            }

            // 1. Regular History
            processEntries(history.inbound, 'Inbound')
            processEntries(history.exports, 'Export')

            // 2. Accounting Sync Specific History
            processEntries((history as any).accounting_sync?.inbound, 'Inbound')
            processEntries((history as any).accounting_sync?.exports, 'Export')
        })

        // Sort by date descending
        allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        setEntries(allEntries)
        setLoading(false)
    }

    const filteredEntries = entries.filter(entry => {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
            entry.lot_code.toLowerCase().includes(searchLower) ||
            entry.order_code?.toLowerCase().includes(searchLower) ||
            entry.customer_supplier.toLowerCase().includes(searchLower) ||
            entry.items.some((item: any) =>
                (item.product_name || '').toLowerCase().includes(searchLower) ||
                (item.product_sku || '').toLowerCase().includes(searchLower)
            )

        const matchesDate = !dateFilter || entry.date.startsWith(dateFilter)
        const matchesType = typeFilter === 'all' || entry.type === typeFilter

        return matchesSearch && matchesDate && matchesType
    })

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 shadow-sm">
                            <LinkIcon size={24} strokeWidth={2.5} />
                        </div>
                        Nhật ký liên kết
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11">
                        Đối soát liên kết giữa các lô hàng (LOT) và chứng từ kế toán (PNK/PXK).
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 text-stone-500 hover:text-orange-600 transition-colors shadow-sm"
                        title="Tải lại dữ liệu"
                    >
                        <History size={20} />
                    </button>
                    <button
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all shadow-lg shadow-orange-500/20"
                    >
                        <Download size={18} />
                        Xuất Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm LOT, Phiếu, SP..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>

                <div className="relative group">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                </div>

                <div className="relative group">
                    <History className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as any)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none appearance-none cursor-pointer"
                    >
                        <option value="all">Tất cả luồng</option>
                        <option value="Inbound">Luồng Nhập (IN)</option>
                        <option value="Export">Luồng Xuất (OUT)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                </div>

                <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Tổng số dòng</span>
                        <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{filteredEntries.length}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                            <p className="mt-4 text-stone-500 font-medium">Đang đối soát dữ liệu...</p>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <History className="opacity-10 mb-4" size={64} />
                            <p className="text-stone-500 font-medium">Không tìm thấy dữ liệu liên kết</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-700">
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-40">Thời gian</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-24">Luồng</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Thông tin LOT</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Sản phẩm & SL</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Chứng từ KT</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Đối tượng</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-stone-700 dark:text-stone-200">
                                                    {new Date(entry.date).toLocaleDateString('vi-VN')}
                                                </span>
                                                <span className="text-[10px] text-stone-400 font-medium">
                                                    {new Date(entry.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col gap-1">
                                                {entry.type === 'Inbound' ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800/40 w-fit">
                                                        <ArrowDownToLine size={10} />
                                                        NHẬP
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-800/40 w-fit">
                                                        <ArrowUpFromLine size={10} />
                                                        XUẤT
                                                    </span>
                                                )}
                                                {entry.is_adjustment && (
                                                    <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-tighter">
                                                        Điều chỉnh
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <Link
                                                    href={`/warehouses/lots?search=${entry.lot_code}`}
                                                    className="font-mono text-xs font-bold text-blue-600 hover:orange-600 underline decoration-blue-200 underline-offset-2 flex items-center gap-1 w-fit group"
                                                >
                                                    {entry.lot_code}
                                                    <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </Link>
                                                <span className="text-[10px] text-stone-500 mt-1 italic truncate max-w-[150px]" title={entry.description}>
                                                    {entry.description}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-stone-800 dark:text-stone-100 tabular-nums">
                                                        {entry.quantity.toLocaleString('vi-VN')}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest bg-stone-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                        {entry.unit}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {entry.items.slice(0, 2).map((item: any, idx: number) => (
                                                        <span key={idx} className="text-[10px] text-stone-500 bg-stone-50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded border border-stone-100 dark:border-slate-800">
                                                            {item.product_name || item.product_sku}
                                                        </span>
                                                    ))}
                                                    {entry.items.length > 2 && (
                                                        <span className="text-[10px] text-stone-400 italic">+{entry.items.length - 2} sản phẩm khác</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {entry.order_id ? (
                                                <div className="flex flex-col">
                                                    <Link
                                                        href={entry.type === 'Inbound' ? `/inbound?search=${entry.order_code}` : `/outbound?search=${entry.order_code}`}
                                                        className="font-mono text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded border border-emerald-100 dark:border-emerald-800/40 flex items-center gap-1.5 w-fit"
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                        {entry.order_code}
                                                    </Link>
                                                    <span className="text-[10px] text-emerald-500/70 mt-1 font-medium italic">Đã đồng bộ sang KT</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <div className="text-stone-400 text-xs font-medium flex items-center gap-1.5 bg-stone-50 dark:bg-slate-800/50 px-2.5 py-1 rounded border border-stone-100 dark:border-slate-800 w-fit">
                                                        <History size={12} className="opacity-50" />
                                                        Chưa đồng bộ
                                                    </div>
                                                    <span className="text-[10px] text-stone-400/70 mt-1 italic">Hàng chờ (Buffer)</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                                                <Building2 size={14} className="text-stone-300 dark:text-slate-600" />
                                                <span className="font-medium truncate max-w-[120px]" title={entry.customer_supplier}>
                                                    {entry.customer_supplier}
                                                </span>
                                            </div>
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
