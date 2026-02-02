'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { History, Search, Download, Calendar, Boxes, ArrowRightLeft, Combine, Split, Package, Building2, Tag as TagIcon, Filter, Layers, ChevronDown, ArrowUpRight } from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { useSystem } from '@/contexts/SystemContext'

type LotWithDetails = {
    id: string
    code: string
    created_at: string
    inbound_date: string | null
    notes: string | null
    quantity: number | null
    metadata: any
    suppliers: { name: string } | null
    products: { name: string; sku: string; unit: string } | null
    lot_items: Array<{
        id: string
        quantity: number
        unit: string | null
        products: { name: string; sku: string; unit: string } | null
    }>
    lot_tags: Array<{
        tag: string
        lot_item_id: string | null
    }>
}

export default function LotHistoryPage() {
    const [lots, setLots] = useState<LotWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState('')
    const [actionTypeFilter, setActionTypeFilter] = useState('all')
    const { systemType } = useSystem()

    useEffect(() => {
        fetchLotHistory()
    }, [systemType])

    async function fetchLotHistory() {
        setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                suppliers (name),
                products (name, sku, unit),
                lot_items (
                    id,
                    quantity,
                    unit,
                    products (name, sku, unit)
                ),
                lot_tags (tag, lot_item_id)
            `)
            .eq('system_code', systemType)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lot history:', error)
        } else {
            setLots(data as any)
        }
        setLoading(false)
    }

    const getLotActionData = (lot: LotWithDetails) => {
        const history = lot.metadata?.system_history

        // 1. Target of a Merge
        const mergeFrom = lot.lot_items?.find(item => lot.metadata?.system_history?.item_history?.[item.id]?.type === 'merge')
        if (mergeFrom) {
            const itemHistory = lot.metadata.system_history.item_history[mergeFrom.id]
            const sourceCode = itemHistory.source_code
            return { type: 'merge_target', label: `Gộp từ ${sourceCode}`, variant: 'purple', date: itemHistory.snapshot?.merge_date }
        }

        // 2. Result of a Split
        const splitFromItem = lot.lot_items?.find(item => (lot.metadata as any)?.system_history?.item_history?.[item.id]?.type === 'split')
        const splitFromMetadata = (lot.metadata as any)?.system_history?.item_history?.source_code // Fallback if item_id changed

        if (splitFromItem || splitFromMetadata) {
            const itemHistory = splitFromItem ? (lot.metadata as any).system_history.item_history[splitFromItem.id] : null
            const sourceCode = itemHistory ? itemHistory.source_code : splitFromMetadata
            return { type: 'split_result', label: `Tách từ ${sourceCode}`, variant: 'orange', date: itemHistory?.snapshot?.split_date }
        }

        // 3. Source of a Merge (Released)
        if (history?.merged_to) {
            return { type: 'merge_source', label: `Đã gộp vào ${history.merged_to}`, variant: 'slate' }
        }

        // 4. Origin of a Split
        if (history?.split_to && history.split_to.length > 0) {
            const dests = Array.isArray(history.split_to) ? history.split_to.join(', ') : history.split_to
            return { type: 'split_origin', label: `Đã tách ra ${dests}`, variant: 'pink' }
        }

        // 5. Exports (Actual Customer Exports)
        if (history?.exports && history.exports.length > 0) {
            const lastExport = history.exports[history.exports.length - 1]
            // Skip adjustment exports here, they will be handled by the edit/adjustment section below
            if (!lastExport.is_adjustment) {
                const dest = lastExport.customer
                return { type: 'export', label: `Đã xuất cho ${dest}`, variant: 'blue', date: lastExport.date }
            }
        }

        // 6. Legacy Tags
        const legacyMerge = lot.lot_tags?.find(t => t.tag.startsWith('MERGED_FROM:'))
        if (legacyMerge) return { type: 'merge_target', label: 'Gộp (Dữ liệu cũ)', variant: 'purple' }

        const legacySplit = lot.lot_tags?.find(t => t.tag.startsWith('SPLIT_FROM:'))
        if (legacySplit) return { type: 'split_result', label: 'Tách (Dữ liệu cũ)', variant: 'orange' }

        // 7. Manual Edits
        if (history?.edits && history.edits.length > 0) {
            const lastEdit = history.edits[history.edits.length - 1]
            return { type: 'edit', label: 'Chỉnh sửa', variant: 'amber', date: lastEdit.date, changes: lastEdit.changes }
        }

        // 8. Default Create
        return { type: 'create', label: 'Tạo mới', variant: 'emerald' }
    }

    const filteredLots = lots.filter(lot => {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch =
            lot.code.toLowerCase().includes(searchLower) ||
            lot.products?.name.toLowerCase().includes(searchLower) ||
            lot.products?.sku.toLowerCase().includes(searchLower) ||
            lot.lot_items.some(item =>
                item.products?.name.toLowerCase().includes(searchLower) ||
                item.products?.sku.toLowerCase().includes(searchLower)
            )

        const matchesDate = !dateFilter || (lot.created_at && lot.created_at.startsWith(dateFilter))

        const actionData = getLotActionData(lot)
        const matchesAction = actionTypeFilter === 'all' ||
            (actionTypeFilter === 'create' && actionData.type === 'create') ||
            (actionTypeFilter === 'merge' && (actionData.type === 'merge_target' || actionData.type === 'merge_source')) ||
            (actionTypeFilter === 'split' && (actionData.type === 'split_result' || actionData.type === 'split_origin')) ||
            (actionTypeFilter === 'export' && actionData.type === 'export') ||
            (actionTypeFilter === 'edit' && actionData.type === 'edit')

        return matchesSearch && matchesDate && matchesAction
    }).sort((a, b) => {
        const dateA = getLotActionData(a).date || a.created_at
        const dateB = getLotActionData(b).date || b.created_at
        return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    const getActionBadge = (lot: LotWithDetails) => {
        const { label, variant, changes } = getLotActionData(lot)

        const variants: Record<string, string> = {
            emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
            orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
            slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
            amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
        }

        const icons: Record<string, any> = {
            emerald: <Boxes size={12} />,
            purple: <Combine size={12} />,
            orange: <Split size={12} />,
            slate: <ArrowRightLeft size={12} />,
            pink: <Split size={12} />,
            blue: <ArrowUpRight size={12} />,
            amber: <History size={12} />
        }

        return (
            <div className="flex flex-col items-start gap-1">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tight ${variants[variant] || variants.emerald}`}>
                    {icons[variant] || icons.emerald}
                    {label}
                </span>

                {changes && changes.length > 0 && (
                    <div className="flex flex-col gap-0.5 ml-1">
                        {changes.map((change: string, idx: number) => (
                            <span key={idx} className="text-[9px] text-stone-500 dark:text-stone-400 font-medium leading-tight italic">
                                • {change}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header section with glassmorphism style */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400 shadow-sm">
                            <History size={24} strokeWidth={2.5} />
                        </div>
                        Nhật ký xuất nhập LOT
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11">
                        Theo dõi lịch sử khởi tạo, gộp và tách các lô hàng.
                    </p>
                </div>

                <button
                    onClick={() => { }} // TODO: Implement export
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 active:scale-95 transition-all shadow-lg shadow-orange-500/20 w-fit"
                >
                    <Download size={18} />
                    Xuất báo cáo
                </button>
            </div>

            {/* Filters Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
                <div className="relative group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm LOT, SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
                    />
                </div>

                <div className="relative group">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium appearance-none"
                    />
                </div>

                <div className="relative group">
                    <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                    <select
                        value={actionTypeFilter}
                        onChange={(e) => setActionTypeFilter(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium appearance-none cursor-pointer"
                    >
                        <option value="all">Mọi hình thức</option>
                        <option value="create">Tạo mới</option>
                        <option value="merge">Gộp LOT</option>
                        <option value="split">Tách LOT</option>
                        <option value="export">Xuất kho</option>
                        <option value="edit">Chỉnh sửa</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">Tổng: {filteredLots.length}</span>
                </div>
            </div>

            {/* Main Table Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                            <p className="mt-4 text-stone-500 font-medium">Đang tải dữ liệu...</p>
                        </div>
                    ) : filteredLots.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="p-4 bg-stone-50 dark:bg-slate-800 rounded-full mb-4">
                                <History className="opacity-20" size={48} />
                            </div>
                            <p className="text-stone-500 font-medium">Không tìm thấy dữ liệu phù hợp</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-700">
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Thời gian</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Mã LOT</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Sản phẩm</th>
                                    <th className="text-center px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">SL & Đơn vị</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Hình thức</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px]">Nhà cung cấp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredLots.map(lot => (
                                    <tr key={lot.id} className="hover:bg-orange-50/30 dark:hover:bg-orange-900/5 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(() => {
                                                const actionData = getLotActionData(lot);
                                                const displayDate = actionData.date || lot.created_at;
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-stone-800 dark:text-stone-200">
                                                            {new Date(displayDate).toLocaleDateString('vi-VN')}
                                                        </span>
                                                        <span className="text-[10px] text-stone-400 font-medium tracking-tight">
                                                            {new Date(displayDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                )
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-100 dark:bg-slate-800 rounded-lg border border-stone-200 dark:border-slate-700 font-mono text-xs font-bold text-stone-700 dark:text-stone-300 shadow-sm group-hover:border-orange-300 dark:group-hover:border-orange-800 transition-colors">
                                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                                                {lot.code}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 min-w-[300px]">
                                            <div className="space-y-2">
                                                {lot.lot_items && lot.lot_items.length > 0 ? (
                                                    lot.lot_items.map((item, idx) => (
                                                        <div key={item.id} className="flex flex-col">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter">
                                                                    {item.products?.sku}
                                                                </span>
                                                                <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[200px]" title={item.products?.name}>
                                                                    {item.products?.name}
                                                                </span>
                                                            </div>
                                                            {/* Show tags for items if available */}
                                                            {lot.lot_tags && lot.lot_tags.some(t => t.lot_item_id === item.id) && (
                                                                <div className="mt-1">
                                                                    <TagDisplay
                                                                        tags={lot.lot_tags.filter(t => t.lot_item_id === item.id).map(t => t.tag)}
                                                                        placeholderMap={{ '@': item.products?.sku || '' }}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    (() => {
                                                        const actionData = getLotActionData(lot);
                                                        const lastExport = lot.metadata?.system_history?.exports?.[lot.metadata?.system_history?.exports?.length - 1];

                                                        if (actionData.type === 'export' && lastExport?.items) {
                                                            return Object.values(lastExport.items).map((item: any, idx) => (
                                                                <div key={idx} className="flex flex-col">
                                                                    <div className="flex items-center gap-2 mb-0.5">
                                                                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter">
                                                                            {item.product_sku}
                                                                        </span>
                                                                        <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[200px]" title={item.product_name}>
                                                                            {item.product_name}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ));
                                                        }

                                                        return (
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter">
                                                                        {lot.products?.sku || 'N/A'}
                                                                    </span>
                                                                    <span className="font-bold text-stone-900 dark:text-stone-100">
                                                                        {lot.products?.name || 'Sản phẩm không xác định'}
                                                                    </span>
                                                                </div>
                                                                {lot.lot_tags && lot.lot_tags.length > 0 && (
                                                                    <div className="mt-1">
                                                                        <TagDisplay
                                                                            tags={lot.lot_tags.map(t => t.tag)}
                                                                            placeholderMap={{ '@': lot.products?.sku || '' }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                {(() => {
                                                    const actionData = getLotActionData(lot);
                                                    const lastExport = lot.metadata?.system_history?.exports?.[lot.metadata?.system_history?.exports?.length - 1];

                                                    if (actionData.type === 'export' && lastExport?.items) {
                                                        const groups: Record<string, number> = {}
                                                        Object.values(lastExport.items).forEach((item: any) => {
                                                            const u = item.unit || 'Đơn vị'
                                                            groups[u] = (groups[u] || 0) + (item.exported_quantity || 0)
                                                        })

                                                        return Object.entries(groups).map(([unit, qty], idx) => (
                                                            <div key={idx} className="flex flex-col items-center">
                                                                <span className="text-base font-black text-blue-600 dark:text-blue-500 tabular-nums">
                                                                    {qty}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                                                                    {unit}
                                                                </span>
                                                            </div>
                                                        ))
                                                    }

                                                    // Default grouping by unit for lot items
                                                    const groups: Record<string, number> = {}
                                                    if (lot.lot_items && lot.lot_items.length > 0) {
                                                        lot.lot_items.forEach((item: any) => {
                                                            const u = item.unit || item.products?.unit || 'Đơn vị'
                                                            groups[u] = (groups[u] || 0) + (item.quantity || 0)
                                                        })
                                                    } else {
                                                        const u = lot.products?.unit || 'Đơn vị'
                                                        groups[u] = (groups[u] || 0) + (lot.quantity || 0)
                                                    }

                                                    return Object.entries(groups).map(([unit, qty], idx) => (
                                                        <div key={idx} className="flex flex-col items-center">
                                                            <span className="text-base font-black text-orange-600 dark:text-orange-500 tabular-nums">
                                                                {qty}
                                                            </span>
                                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                                                                {unit}
                                                            </span>
                                                        </div>
                                                    ))
                                                })()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getActionBadge(lot)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400 font-medium">
                                                <Building2 size={16} className="text-stone-300 dark:text-slate-600" />
                                                <span className="truncate max-w-[150px]" title={lot.suppliers?.name || '-'}>
                                                    {lot.suppliers?.name || '-'}
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

            {/* Footer space */}
            <div className="h-10"></div>
        </div>
    )
}
