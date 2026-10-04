'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'
import { 
    History, Search, Download, Calendar, Boxes, ArrowRightLeft, 
    Combine, Split, Package, Building2, Tag as TagIcon, Filter, 
    Layers, ChevronDown, ArrowUpRight, MapPin, RefreshCw,
    ChevronLeft, ChevronRight, Loader2, RotateCcw, Trash2,
    CheckCircle2, AlertCircle, Eye, Globe
} from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { format, subDays, parseISO, startOfDay, endOfDay, startOfMonth } from 'date-fns'
import { exportLotHistoryToExcel } from '@/lib/lotHistoryExcelExport'
import { RecreateLotModal } from '@/components/lots/RecreateLotModal'

type LotActionData = {
    type: 'create' | 'merge_target' | 'merge_source' | 'split_result' | 'split_origin' | 'export' | 'edit' | 'delete'
    label: string
    variant: string
    date?: string
    changes?: string[]
}

type LotWithDetails = {
    id: string
    code: string
    created_at: string
    inbound_date: string | null
    notes: string | null
    quantity: number | null
    daily_seq?: number | null
    product_id?: string | null
    production_code?: string | null
    batch_code?: string | null
    metadata: any
    status?: string | null
    suppliers: { name: string } | null
    products: { name: string; sku: string; unit: string } | null
    productions: { code: string; name: string } | null
    positions: Array<{ id: string; code: string }> | null
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
    _isDeleted?: boolean
    _deletedAt?: string
    _changedBy?: string
    _rawOldData?: any
    _actionData?: LotActionData
    _sortTime?: number
}

type DatePreset = '7days' | 'today' | '30days' | 'month' | 'custom' | 'all'
type StatusFilterType = 'all' | 'active' | 'exported' | 'deleted'

export default function LotHistoryPage() {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()

    const [lots, setLots] = useState<LotWithDetails[]>([])
    const [loading, setLoading] = useState(true)
    const [isExporting, setIsExporting] = useState(false)

    // Recreate modal state
    const [selectedLotForRecreate, setSelectedLotForRecreate] = useState<LotWithDetails | null>(null)

    // Date range filtering
    const [datePreset, setDatePreset] = useState<DatePreset>('7days')
    const [dateFrom, setDateFrom] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))

    // Status filter
    const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all')

    // Search and action filter
    const [searchTerm, setSearchTerm] = useState('')
    const [actionTypeFilter, setActionTypeFilter] = useState('all')

    // Global Search mode (ignore date filter to find any LOT in history)
    const [isGlobalSearching, setIsGlobalSearching] = useState(false)

    // Pagination
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)

    const getLotActionData = useCallback((lot: LotWithDetails): LotActionData => {
        // 0. Deleted Lot
        if (lot._isDeleted || lot.status === 'deleted') {
            return {
                type: 'delete',
                label: 'Đã xóa',
                variant: 'rose',
                date: lot._deletedAt || lot.created_at
            }
        }

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
        const splitFromMetadata = (lot.metadata as any)?.system_history?.item_history?.source_code

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

        // 5. Exports (Actual Customer Exports OR status = 'exported')
        if (lot.status === 'exported' || (history?.exports && history.exports.length > 0)) {
            const lastExport = history?.exports?.[history.exports.length - 1]
            const customer = lastExport?.customer ? ` cho ${lastExport.customer}` : ''
            const exportDate = lastExport?.date || lot.metadata?.export_date || lot.created_at
            return {
                type: 'export',
                label: `Đã xuất bán${customer}`,
                variant: 'blue',
                date: exportDate
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
    }, [])

    const fetchLotHistory = useCallback(async (isGlobal: boolean = false) => {
        if (!systemType) return
        setLoading(true)

        try {
            // 1. QUERY LOTS TABLE (Active & Exported lots)
            let lotsQuery = supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    created_at,
                    inbound_date,
                    notes,
                    quantity,
                    daily_seq,
                    product_id,
                    production_code,
                    batch_code,
                    metadata,
                    status,
                    suppliers (name),
                    products (name, sku, unit),
                    productions (code, name),
                    positions!positions_lot_id_fkey (id, code),
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

            // Apply status filter if not 'all' and not 'deleted'
            if (statusFilter === 'active') {
                lotsQuery = lotsQuery.eq('status', 'active')
            } else if (statusFilter === 'exported') {
                lotsQuery = lotsQuery.eq('status', 'exported')
            }

            // Apply date filter only when not global search
            if (!isGlobal && datePreset !== 'all' && statusFilter !== 'deleted') {
                if (dateFrom) {
                    lotsQuery = lotsQuery.gte('created_at', startOfDay(parseISO(dateFrom)).toISOString())
                }
                if (dateTo) {
                    lotsQuery = lotsQuery.lte('created_at', endOfDay(parseISO(dateTo)).toISOString())
                }
                lotsQuery = lotsQuery.limit(5000)
            } else {
                lotsQuery = lotsQuery.limit(1000)
            }

            let loadedLots: any[] = []
            if (statusFilter !== 'deleted') {
                const { data: lotsData, error: lotsErr } = await lotsQuery
                if (lotsErr) throw lotsErr
                loadedLots = lotsData || []
            }

            // 2. QUERY AUDIT_LOGS FOR DELETED LOTS
            let deletedLots: any[] = []
            if (statusFilter === 'all' || statusFilter === 'deleted') {
                let auditQuery = supabase
                    .from('audit_logs')
                    .select('*')
                    .eq('table_name', 'lots')
                    .eq('action', 'DELETE')
                    .eq('system_code', systemType)
                    .order('created_at', { ascending: false })

                if (!isGlobal && datePreset !== 'all') {
                    if (dateFrom) {
                        auditQuery = auditQuery.gte('created_at', startOfDay(parseISO(dateFrom)).toISOString())
                    }
                    if (dateTo) {
                        auditQuery = auditQuery.lte('created_at', endOfDay(parseISO(dateTo)).toISOString())
                    }
                }
                auditQuery = auditQuery.limit(1000)

                const { data: auditData } = await auditQuery
                if (auditData && auditData.length > 0) {
                    deletedLots = auditData.map((log: any) => {
                        const oldData = log.old_data || {}
                        return {
                            id: log.record_id || log.id,
                            code: oldData.code || 'LOT-' + String(log.record_id).slice(0, 8),
                            created_at: oldData.created_at || log.created_at,
                            inbound_date: oldData.inbound_date || null,
                            notes: oldData.notes || null,
                            quantity: oldData.quantity ?? 0,
                            daily_seq: oldData.daily_seq || null,
                            product_id: oldData.product_id || null,
                            production_code: oldData.production_code || null,
                            batch_code: oldData.batch_code || null,
                            metadata: oldData.metadata || {},
                            status: 'deleted',
                            suppliers: oldData.suppliers || (oldData.supplier_id ? { name: 'Nhà cung cấp' } : null),
                            products: oldData.products || null,
                            productions: oldData.productions || (oldData.production_code ? { code: oldData.production_code, name: '' } : null),
                            positions: oldData.positions || null,
                            lot_items: oldData.lot_items || [],
                            lot_tags: oldData.lot_tags || [],
                            _isDeleted: true,
                            _deletedAt: log.created_at,
                            _changedBy: log.changed_by,
                            _rawOldData: oldData
                        }
                    })
                }
            }

            // Combine and precompute action data & sorting timestamp
            const combined = [...loadedLots, ...deletedLots].map((lot: any) => {
                const actionData = getLotActionData(lot)
                const sortTime = new Date(actionData.date || lot.created_at).getTime()
                return {
                    ...lot,
                    _actionData: actionData,
                    _sortTime: isNaN(sortTime) ? 0 : sortTime
                }
            })

            setLots(combined)
        } catch (error: any) {
            console.error('Error fetching lot history:', error)
            showToast('Lỗi khi tải dữ liệu: ' + (error.message || 'Thử lại sau'), 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, statusFilter, datePreset, dateFrom, dateTo, getLotActionData, showToast])

    useEffect(() => {
        fetchLotHistory(isGlobalSearching)
    }, [fetchLotHistory, isGlobalSearching])

    // Reset to page 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchTerm, actionTypeFilter, statusFilter, datePreset, dateFrom, dateTo, pageSize])

    const handlePresetChange = (preset: DatePreset) => {
        setIsGlobalSearching(false)
        setDatePreset(preset)
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        if (preset === 'today') {
            setDateFrom(todayStr)
            setDateTo(todayStr)
        } else if (preset === '7days') {
            setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
            setDateTo(todayStr)
        } else if (preset === '30days') {
            setDateFrom(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
            setDateTo(todayStr)
        } else if (preset === 'month') {
            setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
            setDateTo(todayStr)
        }
    }

    const filteredLots = useMemo(() => {
        const searchTrimmed = searchTerm.trim()
        const encodedSearchStt = encodeSTT(searchTrimmed)
        const searchLower = searchTrimmed.toLowerCase()

        return lots.filter(lot => {
            const matchesBlock = (code: string | undefined | null, search: string): boolean => {
                if (!code) return false
                const codeUpper = code.toUpperCase()
                const searchUpper = search.toUpperCase()
                if (!searchUpper) return true
                if (codeUpper.startsWith(searchUpper)) return true
                const parts = codeUpper.split('-')
                return parts.includes(searchUpper)
            }

            const matchesDailySeq = encodedSearchStt !== null && lot.daily_seq === encodedSearchStt

            const matchesSearch = !searchTrimmed ||
                matchesBlock(lot.code, searchTrimmed) ||
                matchesDailySeq ||
                lot.products?.name?.toLowerCase()?.includes(searchLower) ||
                lot.products?.sku?.toLowerCase()?.includes(searchLower) ||
                lot.lot_items?.some(item =>
                    item.products?.name?.toLowerCase()?.includes(searchLower) ||
                    item.products?.sku?.toLowerCase()?.includes(searchLower)
                )

            const actionData = lot._actionData || getLotActionData(lot)
            const matchesAction = actionTypeFilter === 'all' ||
                (actionTypeFilter === 'create' && actionData.type === 'create') ||
                (actionTypeFilter === 'merge' && (actionData.type === 'merge_target' || actionData.type === 'merge_source')) ||
                (actionTypeFilter === 'split' && (actionData.type === 'split_result' || actionData.type === 'split_origin')) ||
                (actionTypeFilter === 'export' && actionData.type === 'export') ||
                (actionTypeFilter === 'edit' && actionData.type === 'edit') ||
                (actionTypeFilter === 'delete' && (actionData.type === 'delete' || lot._isDeleted))

            return matchesSearch && matchesAction
        }).sort((a, b) => (b._sortTime || 0) - (a._sortTime || 0))
    }, [lots, searchTerm, actionTypeFilter, getLotActionData])

    // Pagination slice
    const totalPages = Math.ceil(filteredLots.length / pageSize) || 1
    const paginatedLots = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return filteredLots.slice(start, start + pageSize)
    }, [filteredLots, currentPage, pageSize])

    const getActionBadge = (lot: LotWithDetails) => {
        const { label, variant, changes } = lot._actionData || getLotActionData(lot)

        const variants: Record<string, string> = {
            emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
            orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
            slate: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
            pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800',
            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
            amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
        }

        const icons: Record<string, any> = {
            emerald: <Boxes size={12} />,
            purple: <Combine size={12} />,
            orange: <Split size={12} />,
            slate: <ArrowRightLeft size={12} />,
            pink: <Split size={12} />,
            blue: <ArrowUpRight size={12} />,
            amber: <History size={12} />,
            rose: <Trash2 size={12} />
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

    const productSummary = useMemo(() => {
        const summary: Record<string, { name: string; sku: string; unit: string; totalQty: number }> = {}

        filteredLots.forEach(lot => {
            const actionData = lot._actionData || getLotActionData(lot)
            const lastExport = lot.metadata?.system_history?.exports?.[lot.metadata?.system_history?.exports?.length - 1]

            // 1. Trường hợp là Export
            if (actionData.type === 'export' && lastExport?.items) {
                Object.values(lastExport.items).forEach((item: any) => {
                    const sku = item.product_sku || '-'
                    const key = `${item.product_id}_${item.unit || 'Đơn vị'}`
                    if (!summary[key]) {
                        summary[key] = {
                            name: item.product_name || 'Sản phẩm không tên',
                            sku: sku,
                            unit: item.unit || 'Đơn vị',
                            totalQty: 0
                        }
                    }
                    summary[key].totalQty += (item.exported_quantity || 0)
                })
                return
            }

            // 2. Trường hợp mặc định hoặc các hành động khác
            if (lot.lot_items && lot.lot_items.length > 0) {
                lot.lot_items.forEach((item: any) => {
                    const sku = item.products?.sku || '-'
                    const u = item.unit || item.products?.unit || 'Đơn vị'
                    const key = `${item.product_id}_${u}`
                    if (!summary[key]) {
                        summary[key] = {
                            name: item.products?.name || 'Sản phẩm không tên',
                            sku: sku,
                            unit: u,
                            totalQty: 0
                        }
                    }
                    summary[key].totalQty += (item.quantity || 0)
                })
            } else {
                const sku = lot.products?.sku || '-'
                const u = lot.products?.unit || 'Đơn vị'
                const key = `${lot.product_id}_${u}`
                if (!summary[key]) {
                    summary[key] = {
                        name: lot.products?.name || 'Sản phẩm không tên',
                        sku: sku,
                        unit: u,
                        totalQty: 0
                    }
                }
                summary[key].totalQty += (lot.quantity || 0)
            }
        })

        return Object.values(summary).sort((a, b) => b.totalQty - a.totalQty)
    }, [filteredLots, getLotActionData])

    const handleExportExcel = async () => {
        if (filteredLots.length === 0) {
            showToast('Không có dữ liệu để xuất file Excel', 'warning')
            return
        }
        setIsExporting(true)
        try {
            const dateRangeStr = isGlobalSearching || datePreset === 'all'
                ? 'Toàn bộ thời gian'
                : `${format(parseISO(dateFrom), 'dd/MM/yyyy')} - ${format(parseISO(dateTo), 'dd/MM/yyyy')}`

            await exportLotHistoryToExcel({
                systemName: currentSystem?.name || systemType || 'KHO',
                dateRange: dateRangeStr,
                lots: filteredLots
            })
            showToast(`Đã xuất Excel thành công (${filteredLots.length} lô)`, 'success')
        } catch (err: any) {
            console.error('Error exporting Excel:', err)
            showToast('Lỗi khi xuất file Excel: ' + (err.message || 'Thử lại sau'), 'error')
        } finally {
            setIsExporting(false)
        }
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
                        Nhật ký xuất nhập & Tra cứu LOT
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11">
                        Bản ghi toàn diện: Lô tồn kho, Lô đã xuất bán, Lô đã xóa nhầm và Khôi phục/Tạo lại LOT.
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => fetchLotHistory(isGlobalSearching)}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-700 dark:text-stone-300 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-700/60 active:scale-95 transition-all shadow-sm"
                        title="Tải lại dữ liệu"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-orange-500' : ''} />
                        <span>Làm mới</span>
                    </button>

                    <button
                        onClick={handleExportExcel}
                        disabled={isExporting || loading || filteredLots.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-orange-500/20 w-fit"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span>Đang xuất...</span>
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                <span>Xuất Excel ({filteredLots.length})</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Status Tabs Bar: Tất cả | Còn tồn kho | Đã xuất bán | Đã xóa */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200 dark:border-slate-800">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        statusFilter === 'all'
                            ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900 shadow-md'
                            : 'bg-white dark:bg-slate-900 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 border border-stone-200 dark:border-slate-800'
                    }`}
                >
                    <Layers size={14} />
                    <span>Tất cả</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-stone-500/20 text-[10px]">
                        {statusFilter === 'all' ? filteredLots.length : lots.length}
                    </span>
                </button>

                <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        statusFilter === 'active'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                            : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800'
                    }`}
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                    <span>Còn trong kho (Active)</span>
                </button>

                <button
                    onClick={() => setStatusFilter('exported')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        statusFilter === 'exported'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                            : 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
                    }`}
                >
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    <span>Đã xuất bán (Exported)</span>
                </button>

                <button
                    onClick={() => setStatusFilter('deleted')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                        statusFilter === 'deleted'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/25'
                            : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-rose-200 dark:border-rose-800'
                    }`}
                >
                    <Trash2 size={13} className="text-rose-500" />
                    <span>Đã xóa (Audit Log)</span>
                </button>
            </div>

            {/* Date Range Presets & Time Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                            <Calendar size={14} /> Mốc thời gian:
                        </span>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('7days')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === '7days'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            7 ngày qua
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('today')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === 'today'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Hôm nay
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('30days')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === '30days'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            30 ngày qua
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('month')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === 'month'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Tháng này
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('custom')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === 'custom'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                        >
                            Tùy chọn
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('all')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                !isGlobalSearching && datePreset === 'all'
                                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                    : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                            }`}
                            title="Tải 1.000 bản ghi mới nhất"
                        >
                            Tất cả
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsGlobalSearching(!isGlobalSearching)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isGlobalSearching
                                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                                    : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
                            }`}
                            title="Bỏ qua bộ lọc ngày để tìm kiếm trên toàn bộ dữ liệu lịch sử"
                        >
                            <Globe size={13} />
                            <span>Tìm toàn bộ kho</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isGlobalSearching && datePreset !== 'all' && (
                            <div className="flex items-center gap-2 bg-stone-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-stone-200 dark:border-slate-700">
                                <span className="text-[11px] font-bold text-stone-500 pl-1">Từ:</span>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => {
                                        setDateFrom(e.target.value)
                                        setDatePreset('custom')
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-orange-500"
                                />
                                <span className="text-[11px] font-bold text-stone-500">Đến:</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => {
                                        setDateTo(e.target.value)
                                        setDatePreset('custom')
                                    }}
                                    className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-orange-500"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-stone-100 dark:border-slate-800/60">
                    <div className="relative group md:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-orange-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm LOT, STT LOT, SKU, tên SP (gõ bất kỳ mã nào để tra cứu)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-medium"
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
                            <option value="export">Đã xuất bán</option>
                            <option value="delete">Đã xóa</option>
                            <option value="edit">Chỉnh sửa</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                    </div>

                    <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/50">
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Kết quả lọc:</span>
                        </div>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200 font-mono">
                            {filteredLots.length} <span className="text-xs text-blue-500 font-normal">/ {lots.length} lô</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Section */}
            {productSummary.length > 0 && (
                <div className="bg-stone-50 dark:bg-slate-800/40 border border-stone-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                    <h4 className="text-xs font-black text-stone-700 dark:text-stone-300 uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-4 bg-orange-500 rounded-full"></div>
                        Tổng hợp sản lượng đã lọc ({productSummary.length} sản phẩm)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {productSummary.map((item, idx) => (
                            <div key={idx} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-orange-300 dark:hover:border-orange-950 transition-all">
                                <div className="min-w-0 flex-1 pr-2">
                                    <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5 tracking-tight font-mono">{item.sku}</div>
                                    <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate" title={item.name}>{item.name}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-base font-black text-orange-600 dark:text-orange-500 tabular-nums">
                                        {item.totalQty.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block">
                                        {item.unit}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Table Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                            <p className="mt-4 text-stone-500 font-medium">Đang tải dữ liệu nhanh...</p>
                        </div>
                    ) : filteredLots.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="p-4 bg-stone-50 dark:bg-slate-800 rounded-full mb-4">
                                <History className="opacity-20" size={48} />
                            </div>
                            <p className="text-stone-500 font-medium">Không tìm thấy dữ liệu phù hợp trong khoảng thời gian đã chọn</p>
                            {!isGlobalSearching && (
                                <button
                                    onClick={() => setIsGlobalSearching(true)}
                                    className="mt-3 px-4 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-xs font-bold hover:bg-orange-100 transition-colors flex items-center gap-2"
                                >
                                    <Globe size={14} />
                                    <span>Tìm kiếm trên toàn bộ dữ liệu lịch sử</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-700">
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[11%]">Thời gian</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[14%]">Mã LOT</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[14%]">Lệnh SX & Lô SX</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[22%]">Sản phẩm</th>
                                    <th className="text-center px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[10%]">SL & Đơn vị</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[10%]">Vị trí</th>
                                    <th className="text-left px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[10%]">Hình thức</th>
                                    <th className="text-center px-6 py-4 font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider text-[11px] w-[9%]">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {paginatedLots.map(lot => {
                                    const actionData = lot._actionData || getLotActionData(lot);
                                    const displayDate = actionData.date || lot.created_at;
                                    const isDeleted = lot._isDeleted || lot.status === 'deleted';
                                    const isExported = lot.status === 'exported';

                                    return (
                                        <tr key={lot.id} className={`transition-colors group ${
                                            isDeleted ? 'bg-rose-50/20 dark:bg-rose-950/10 hover:bg-rose-50/40' :
                                            isExported ? 'bg-blue-50/15 dark:bg-blue-950/5 hover:bg-blue-50/30' :
                                            'hover:bg-orange-50/30 dark:hover:bg-orange-900/5'
                                        }`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-stone-800 dark:text-stone-200">
                                                        {displayDate ? new Date(displayDate).toLocaleDateString('vi-VN') : '-'}
                                                    </span>
                                                    <span className="text-[10px] text-stone-400 font-medium tracking-tight">
                                                        {displayDate ? new Date(displayDate).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border font-mono text-xs font-bold shadow-sm transition-colors ${
                                                        isDeleted
                                                            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 line-through'
                                                            : isExported
                                                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                                                            : 'bg-stone-100 dark:bg-slate-800 border-stone-200 dark:border-slate-700 text-stone-700 dark:text-stone-300'
                                                    }`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                            isDeleted ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' :
                                                            isExported ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                                            'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                        }`}></div>
                                                        {lot.code}
                                                    </div>
                                                    {lot.daily_seq && (
                                                        <span className="px-1.5 py-0.5 bg-orange-600 text-white rounded text-[9px] font-bold leading-none font-mono shrink-0" title="STT LOT trong ngày">
                                                            STT: {decodeSTT(lot.daily_seq)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    {lot.productions ? (
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-tighter w-fit" title={lot.productions.name}>
                                                            LSX: {lot.productions.code}
                                                        </span>
                                                    ) : lot.production_code ? (
                                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold border border-indigo-100 dark:border-indigo-800/50 uppercase tracking-tighter w-fit">
                                                            LSX: {lot.production_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-stone-400 font-medium italic">Không xác định</span>
                                                    )}
                                                    {lot.batch_code || lot.metadata?.batch_code ? (
                                                        <span className="text-[10px] text-stone-600 dark:text-stone-400 font-mono font-bold">
                                                            Lô: {lot.batch_code || lot.metadata?.batch_code}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-stone-400 font-medium italic">Không có mã lô</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 min-w-[230px]">
                                                <div className="space-y-2">
                                                    {lot.lot_items && lot.lot_items.length > 0 ? (
                                                        lot.lot_items.map((item) => (
                                                            <div key={item.id} className="flex flex-col gap-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter shrink-0">
                                                                        {item.products?.sku || '-'}
                                                                    </span>
                                                                    {lot.lot_tags && lot.lot_tags.some(t => t.lot_item_id === item.id) && (
                                                                        <div className="inline-flex shrink-0">
                                                                            <TagDisplay
                                                                                tags={lot.lot_tags.filter(t => t.lot_item_id === item.id).map(t => t.tag)}
                                                                                placeholderMap={{ '@': item.products?.sku || '' }}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[220px]" title={item.products?.name}>
                                                                    {item.products?.name || 'Sản phẩm'}
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        (() => {
                                                            const lastExport = lot.metadata?.system_history?.exports?.[lot.metadata?.system_history?.exports?.length - 1];

                                                            if (actionData.type === 'export' && lastExport?.items) {
                                                                return Object.values(lastExport.items).map((item: any, idx) => (
                                                                    <div key={idx} className="flex flex-col gap-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter shrink-0">
                                                                                {item.product_sku}
                                                                            </span>
                                                                        </div>
                                                                        <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[220px]" title={item.product_name}>
                                                                            {item.product_name}
                                                                        </span>
                                                                    </div>
                                                                ));
                                                            }

                                                            return (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded text-[10px] font-bold border border-blue-100 dark:border-blue-800/50 uppercase tracking-tighter shrink-0">
                                                                            {lot.products?.sku || 'N/A'}
                                                                        </span>
                                                                        {lot.lot_tags && lot.lot_tags.length > 0 && (
                                                                            <div className="inline-flex shrink-0">
                                                                                <TagDisplay
                                                                                    tags={lot.lot_tags.map(t => t.tag)}
                                                                                    placeholderMap={{ '@': lot.products?.sku || '' }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className="font-bold text-stone-900 dark:text-stone-100 truncate max-w-[220px]" title={lot.products?.name}>
                                                                        {lot.products?.name || 'Sản phẩm không xác định'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center">
                                                    {(() => {
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
                                                                <span className={`text-base font-black tabular-nums ${isDeleted ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-500'}`}>
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
                                                <div className="flex flex-wrap gap-1 max-w-[130px]">
                                                    {lot.positions && lot.positions.length > 0 ? (
                                                        lot.positions.map(pos => (
                                                            <span key={pos.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded text-[10px] font-bold border border-emerald-100 dark:border-emerald-800/50 uppercase tracking-tight">
                                                                <MapPin size={10} className="shrink-0" />
                                                                {pos.code}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 dark:bg-slate-800 text-stone-400 dark:text-slate-500 rounded text-[10px] font-bold border border-stone-200 dark:border-slate-700 uppercase tracking-tight">
                                                            {isDeleted ? 'Đã giải phóng' : isExported ? 'Đã xuất kho' : 'Chưa gán vị trí'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {getActionBadge(lot)}
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => setSelectedLotForRecreate(lot)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                                                        isDeleted
                                                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 hover:shadow-rose-500/20'
                                                            : isExported
                                                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 hover:shadow-blue-500/20'
                                                            : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-slate-700 hover:bg-stone-200'
                                                    }`}
                                                    title={isDeleted ? 'Xem lại thông tin và khôi phục LOT đã xóa' : 'Tạo lại LOT mới từ thông tin này'}
                                                >
                                                    <RotateCcw size={13} />
                                                    <span>{isDeleted ? 'Khôi phục' : 'Tạo lại'}</span>
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination Footer */}
                {filteredLots.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-stone-400">
                            <span>
                                Hiển thị <b className="text-stone-800 dark:text-stone-200">{(currentPage - 1) * pageSize + 1}</b> - <b className="text-stone-800 dark:text-stone-200">{Math.min(currentPage * pageSize, filteredLots.length)}</b> trên tổng số <b className="text-stone-800 dark:text-stone-200">{filteredLots.length}</b> lô hàng
                            </span>

                            <div className="flex items-center gap-1.5">
                                <span>Hiển thị:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:border-orange-500"
                                >
                                    <option value={25}>25 / trang</option>
                                    <option value={50}>50 / trang</option>
                                    <option value={100}>100 / trang</option>
                                </select>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Trang trước"
                                >
                                    <ChevronLeft size={16} />
                                </button>

                                {(() => {
                                    const pages: (number | string)[] = []
                                    if (totalPages <= 7) {
                                        for (let i = 1; i <= totalPages; i++) pages.push(i)
                                    } else {
                                        pages.push(1)
                                        if (currentPage > 3) pages.push('...')
                                        const start = Math.max(2, currentPage - 1)
                                        const end = Math.min(totalPages - 1, currentPage + 1)
                                        for (let i = start; i <= end; i++) pages.push(i)
                                        if (currentPage < totalPages - 2) pages.push('...')
                                        pages.push(totalPages)
                                    }

                                    return pages.map((page, idx) => {
                                        if (page === '...') {
                                            return <span key={idx} className="px-2 text-stone-400 text-xs">...</span>
                                        }
                                        const isCurrent = page === currentPage
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentPage(Number(page))}
                                                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition-all ${
                                                    isCurrent
                                                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                                        : 'hover:bg-white dark:hover:bg-slate-800 text-stone-600 dark:text-stone-400 border border-transparent hover:border-stone-200 dark:hover:border-slate-700'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        )
                                    })
                                })()}

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg border border-stone-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    title="Trang sau"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Recreate Lot Modal */}
            {selectedLotForRecreate && (
                <RecreateLotModal
                    lot={selectedLotForRecreate}
                    onClose={() => setSelectedLotForRecreate(null)}
                    onSuccess={() => {
                        fetchLotHistory(isGlobalSearching)
                    }}
                />
            )}

            {/* Footer space */}
            <div className="h-10"></div>
        </div>
    )
}
