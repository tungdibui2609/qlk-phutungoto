// @ts-nocheck
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    Smartphone, 
    X, 
    RefreshCw, 
    Trash2, 
    Box, 
    Layers, 
    Search, 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    Scale, 
    Tag, 
    Stamp, 
    FileText, 
    LayoutGrid, 
    Table as TableIcon,
    Link2,
    Clock,
    MapPin,
    Users
} from 'lucide-react'
import { decodeSTT } from '@/lib/numberUtils'

interface LotOcrScanModalProps {
    lotId: string
    lotCode: string
    dailySeq?: number | string | null
    lotName?: string
    onClose: () => void
    searchTerm?: string
}

export function LotOcrScanModal({ lotId, lotCode, dailySeq, lotName, onClose, searchTerm: initialSearch = '' }: LotOcrScanModalProps) {
    const { showToast } = useToast()
    const [boxes, setBoxes] = useState<any[]>([])
    const [unlinkedMatchingBoxes, setUnlinkedMatchingBoxes] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUnlinking, setIsUnlinking] = useState<string | null>(null)
    const [isLinkingNow, setIsLinkingNow] = useState(false)
    const [searchQuery, setSearchQuery] = useState(initialSearch)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
    const [filterType, setFilterType] = useState<'all' | 'label' | 'stamp'>('all')

    const sttDisplay = useMemo(() => {
        return decodeSTT(dailySeq) || ''
    }, [dailySeq])

    // Lấy thông tin các thùng đã gắn vào lot này
    const fetchBoxData = useCallback(async () => {
        setIsLoading(true)
        try {
            // 1. Tải danh sách thùng đã gắn vào Lô (lot_id = lotId)
            const { data, error } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    lot_id,
                    quantity,
                    unit,
                    status,
                    semi_finished_lot_code,
                    finished_lot_code,
                    created_at,
                    metadata,
                    products (
                        id,
                        name,
                        sku,
                        internal_code,
                        internal_name
                    )
                `)
                .eq('lot_id', lotId)
                .order('created_at', { ascending: true })

            if (error) throw error

            const sorted = (data || []).sort((a: any, b: any) => {
                const idxA = a.metadata?.box_index ?? parseInt((a.code || '').split('-').pop() || '0', 10)
                const idxB = b.metadata?.box_index ?? parseInt((b.code || '').split('-').pop() || '0', 10)
                return idxA - idxB
            })
            setBoxes(sorted)

            // 2. Nếu Lô chưa có thùng nào và có STT, kiểm tra xem có thùng nào trên điện thoại đã đồng bộ lên với STT này nhưng chưa gán lot_id không
            if ((!data || data.length === 0) && sttDisplay) {
                const { data: pendingData, error: pendingErr } = await supabase
                    .from('box_labels')
                    .select(`
                        id,
                        code,
                        lot_id,
                        quantity,
                        unit,
                        status,
                        semi_finished_lot_code,
                        finished_lot_code,
                        created_at,
                        metadata,
                        products (
                            id,
                            name,
                            sku,
                            internal_code,
                            internal_name
                        )
                    `)
                    .is('lot_id', null)
                    .filter('metadata->>pallet_stt', 'eq', sttDisplay.toUpperCase())

                if (!pendingErr && pendingData && pendingData.length > 0) {
                    setUnlinkedMatchingBoxes(pendingData)
                } else {
                    setUnlinkedMatchingBoxes([])
                }
            } else {
                setUnlinkedMatchingBoxes([])
            }
        } catch (err: any) {
            console.error('Lỗi khi tải dữ liệu quét OCR:', err)
            showToast('Không thể tải dữ liệu quét: ' + err.message, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [lotId, sttDisplay, showToast])

    useEffect(() => {
        if (lotId) {
            fetchBoxData()
        }
    }, [lotId, fetchBoxData])

    // Kết nối nhanh các thùng chưa liên kết có cùng STT vào Lô này
    const handleQuickLink = async () => {
        if (unlinkedMatchingBoxes.length === 0) return
        setIsLinkingNow(true)
        try {
            const ids = unlinkedMatchingBoxes.map(b => b.id)
            const { error } = await supabase
                .from('box_labels')
                .update({ lot_id: lotId, status: 'linked' })
                .in('id', ids)

            if (error) throw error

            showToast(`Đã kết nối thành công ${ids.length} thùng vào Lô này theo STT ${sttDisplay}`, 'success')
            await fetchBoxData()
        } catch (err: any) {
            console.error('Lỗi kết nối thùng theo STT:', err)
            showToast('Không thể kết nối: ' + err.message, 'error')
        } finally {
            setIsLinkingNow(false)
        }
    }

    // Gỡ thùng ra khỏi Lô
    const handleUnlink = async (labelId: string, labelCode: string) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn gỡ thùng "${labelCode}" ra khỏi Lô này không?`)
        if (!confirmed) return

        setIsUnlinking(labelId)
        try {
            const { error } = await supabase
                .from('box_labels')
                .update({ lot_id: null, status: 'unlinked' })
                .eq('id', labelId)

            if (error) throw error

            setBoxes(prev => prev.filter(item => item.id !== labelId))
            showToast(`Đã gỡ liên kết thùng ${labelCode} thành công`, 'success')
        } catch (err: any) {
            console.error('Lỗi gỡ liên kết thùng:', err)
            showToast('Không thể gỡ liên kết: ' + err.message, 'error')
        } finally {
            setIsUnlinking(null)
        }
    }

    // Helper trích xuất số thứ tự thùng
    const getBoxNumber = (box: any): string => {
        if (box.metadata?.box_index !== undefined && box.metadata?.box_index !== null) {
            return String(box.metadata.box_index).padStart(2, '0')
        }
        if (!box.code) return '---'
        const parts = box.code.trim().split('-')
        const last = parts[parts.length - 1]
        return !isNaN(Number(last)) ? String(parseInt(last, 10)).padStart(2, '0') : box.code
    }

    // Lọc danh sách thùng theo tìm kiếm và tab phân loại
    const filteredBoxes = useMemo(() => {
        return boxes.filter(b => {
            const isStamp = b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1
            if (filterType === 'label' && isStamp) return false
            if (filterType === 'stamp' && !isStamp) return false

            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase().trim()
            const matchIndex = getBoxNumber(b).includes(q)
            const matchCode = (b.code || '').toLowerCase().includes(q)
            const matchSku = (b.metadata?.sku || b.products?.sku || '').toLowerCase().includes(q)
            const matchProd = (b.metadata?.product_name || b.products?.name || '').toLowerCase().includes(q)
            const matchLot = (b.semi_finished_lot_code || b.finished_lot_code || b.metadata?.lot_code || '').toLowerCase().includes(q)
            const matchStamp1 = (b.metadata?.stamp_line1 || '').toLowerCase().includes(q)
            const matchStamp2 = (b.metadata?.stamp_line2 || '').toLowerCase().includes(q)
            const matchGroup = (b.metadata?.shift_group || '').toLowerCase().includes(q)
            const matchRegion = (b.metadata?.region || '').toLowerCase().includes(q)

            return matchIndex || matchCode || matchSku || matchProd || matchLot || matchStamp1 || matchStamp2 || matchGroup || matchRegion
        })
    }, [boxes, searchQuery, filterType])

    // Thống kê tổng hợp
    const stats = useMemo(() => {
        const total = boxes.length
        const totalWeight = boxes.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0)
        const unit = boxes[0]?.unit || 'Kg'
        const stampCount = boxes.filter(b => b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1).length
        const labelCount = total - stampCount

        // Lấy thông tin trích xuất chung từ thùng đầu tiên
        const first = boxes[0]
        const sampleSku = first?.metadata?.sku || first?.products?.sku || '---'
        const sampleSpec = first?.metadata?.spec || '---'
        const sampleGroup = first?.metadata?.shift_group || '---'
        const sampleRegion = first?.metadata?.region || '---'
        const samplePackagingDate = first?.metadata?.packaging_date || '---'
        const sampleLotCode = first?.semi_finished_lot_code || first?.finished_lot_code || first?.metadata?.lot_code || '---'

        return {
            total,
            totalWeight,
            unit,
            stampCount,
            labelCount,
            sampleSku,
            sampleSpec,
            sampleGroup,
            sampleRegion,
            samplePackagingDate,
            sampleLotCode
        }
    }, [boxes])

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* 1. Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-850/80 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
                            <Smartphone size={20} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate">
                                    Thông Tin Quét OCR Từ Điện Thoại
                                </h3>
                                {sttDisplay && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 shadow-2xs">
                                        <Tag size={11} /> STT: {sttDisplay}
                                    </span>
                                )}
                                {boxes.length > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Đã kết nối ({boxes.length} thùng)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1">
                                        <AlertCircle size={12} /> Chưa có thùng kết nối
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono truncate">
                                Mã Lô: <span className="font-bold text-slate-800 dark:text-slate-200">{lotCode}</span>
                                {lotName && <span className="font-sans text-slate-600 dark:text-slate-400 ml-2">({lotName})</span>}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
                        title="Đóng"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 2. Body */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                    {/* Báo động phát hiện thùng chưa liên kết nhưng cùng STT */}
                    {unlinkedMatchingBoxes.length > 0 && boxes.length === 0 && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                    <Link2 size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                                        Phát hiện {unlinkedMatchingBoxes.length} thùng đã quét từ điện thoại với STT "{sttDisplay}"
                                    </h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                        Các thùng này đã được đồng bộ lên hệ thống nhưng chưa được gán mã Lô. Bấm nút bên dưới để liên kết ngay vào Lô này.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleQuickLink}
                                disabled={isLinkingNow}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                                {isLinkingNow ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Đang kết nối...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        Kết nối {unlinkedMatchingBoxes.length} thùng ngay
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-3">
                            <RefreshCw className="text-indigo-500 animate-spin" size={32} />
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Đang tải thông tin quét OCR từ thiết bị di động...
                            </p>
                        </div>
                    ) : boxes.length > 0 ? (
                        <div className="space-y-4">
                            {/* Panel Thống Kê Tổng Quan */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/10 border border-indigo-100 dark:border-indigo-900/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                        <Box size={12} /> Tổng số thùng
                                    </div>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                                        {stats.total} <span className="text-xs font-semibold text-slate-500">thùng</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        {stats.total >= 30 ? '✅ Đủ chuẩn Pallet (30 thùng)' : `Đã xếp ${stats.total}/30 thùng`}
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-100 dark:border-emerald-900/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                        <Scale size={12} /> Tổng trọng lượng
                                    </div>
                                    <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                                        {stats.totalWeight.toFixed(2)} <span className="text-xs font-semibold">{stats.unit}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                        TB: {(stats.totalWeight / (stats.total || 1)).toFixed(2)} {stats.unit}/thùng
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/10 border border-purple-100 dark:border-purple-900/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                        <Stamp size={12} /> Phương thức quét
                                    </div>
                                    <div className="text-sm font-black text-purple-700 dark:text-purple-300 mt-1.5 flex items-center gap-1.5">
                                        {stats.stampCount > 0 && stats.labelCount > 0 ? (
                                            'Hỗn hợp tem & dấu'
                                        ) : stats.stampCount > 0 ? (
                                            'Dấu Đóng Mực (Kraft)'
                                        ) : (
                                            'Quét Tem Nhãn (OCR)'
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex gap-2">
                                        {stats.labelCount > 0 && <span>Tem: {stats.labelCount}</span>}
                                        {stats.stampCount > 0 && <span>Dấu: {stats.stampCount}</span>}
                                    </div>
                                </div>

                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-100 dark:border-amber-900/40">
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <Calendar size={12} /> Ngày đóng gói
                                    </div>
                                    <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1.5 truncate">
                                        {stats.samplePackagingDate !== '---' ? stats.samplePackagingDate : 'Chưa nhận diện'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                                        Tổ: {stats.sampleGroup} • Vùng: {stats.sampleRegion}
                                    </div>
                                </div>
                            </div>

                            {/* Thanh công cụ tìm kiếm và lọc */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="relative flex-1 max-w-sm">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Tìm mã thùng, STT #01, SKU, số đóng dấu..."
                                            className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                        />
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Tabs loại tem */}
                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs shrink-0">
                                        <button
                                            onClick={() => setFilterType('all')}
                                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                filterType === 'all'
                                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            Tất cả ({boxes.length})
                                        </button>
                                        {stats.labelCount > 0 && (
                                            <button
                                                onClick={() => setFilterType('label')}
                                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                    filterType === 'label'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                Tem OCR ({stats.labelCount})
                                            </button>
                                        )}
                                        {stats.stampCount > 0 && (
                                            <button
                                                onClick={() => setFilterType('stamp')}
                                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                    filterType === 'stamp'
                                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                Dấu đóng ({stats.stampCount})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Chế độ xem Grid / Table & Refresh */}
                                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-lg transition-all ${
                                                viewMode === 'grid'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                            title="Xem dạng thẻ"
                                        >
                                            <LayoutGrid size={15} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('table')}
                                            className={`p-1.5 rounded-lg transition-all ${
                                                viewMode === 'table'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                            title="Xem dạng bảng"
                                        >
                                            <TableIcon size={15} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={fetchBoxData}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                        title="Làm mới dữ liệu"
                                    >
                                        <RefreshCw size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* Danh Sách Thùng: Grid Cards hoặc Table */}
                            {filteredBoxes.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    Không có thùng nào khớp với bộ lọc hoặc từ khóa tìm kiếm.
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {filteredBoxes.map((box, idx) => {
                                        const boxNum = getBoxNumber(box)
                                        const isStamp = box.metadata?.scan_type === 'stamp' || !!box.metadata?.stamp_line1
                                        const stampL1 = box.metadata?.stamp_line1 || ''
                                        const stampL2 = box.metadata?.stamp_line2 || ''
                                        const sku = box.metadata?.sku || box.products?.sku || '---'
                                        const prodName = box.metadata?.product_name || box.products?.name || 'Sản phẩm tiêu chuẩn'
                                        const spec = box.metadata?.spec || '---'
                                        const group = box.metadata?.shift_group || '---'
                                        const region = box.metadata?.region || '---'
                                        const pkgDate = box.metadata?.packaging_date || '---'
                                        const lotNum = box.semi_finished_lot_code || box.finished_lot_code || box.metadata?.lot_code || '---'

                                        return (
                                            <div 
                                                key={box.id || idx}
                                                className="p-3.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-500/40 transition-all flex flex-col justify-between relative group"
                                            >
                                                {/* Header Card */}
                                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                            #{boxNum}
                                                        </span>
                                                        {isStamp ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                                Dấu Mực Đóng
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                                Tem OCR
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                                                            {box.quantity} {box.unit}
                                                        </span>
                                                        <button
                                                            onClick={() => handleUnlink(box.id, box.code)}
                                                            disabled={isUnlinking === box.id}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                                            title="Gỡ thùng này ra khỏi Lô"
                                                        >
                                                            {isUnlinking === box.id ? (
                                                                <RefreshCw size={12} className="animate-spin" />
                                                            ) : (
                                                                <Trash2 size={12} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Card Content */}
                                                <div className="py-2.5 space-y-1.5 text-xs">
                                                    {isStamp ? (
                                                        <div className="space-y-1 bg-purple-50/50 dark:bg-purple-950/20 p-2 rounded-xl border border-purple-100 dark:border-purple-900/30">
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-purple-600 dark:text-purple-400 font-bold">Dòng 1 (14 số):</span>
                                                                <span className="font-mono font-black text-slate-900 dark:text-white tracking-wider">{stampL1 || '---'}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-purple-600 dark:text-purple-400 font-bold">Dòng 2 (16 số):</span>
                                                                <span className="font-mono font-black text-slate-900 dark:text-white tracking-wider">{stampL2 || '---'}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-slate-500 dark:text-slate-400">SKU / Quy cách:</span>
                                                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                    {sku} {spec !== '---' && `• ${spec}`}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Lô TP/BTP:</span>
                                                                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{lotNum}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Tổ / Vùng trồng:</span>
                                                                <span className="text-slate-700 dark:text-slate-300">
                                                                    {group} • {region}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-slate-500 dark:text-slate-400">Ngày đóng gói:</span>
                                                                <span className="text-slate-700 dark:text-slate-300">{pkgDate}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Card Footer */}
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                                    <span className="truncate max-w-[160px]" title={box.code}>{box.code}</span>
                                                    <span className="flex items-center gap-0.5">
                                                        <Clock size={10} />
                                                        {new Date(box.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                /* Table View */
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                <th className="px-3 py-2.5 text-center w-12">#</th>
                                                <th className="px-3 py-2.5">Mã thùng</th>
                                                <th className="px-3 py-2.5">Loại quét</th>
                                                <th className="px-3 py-2.5">Thông tin OCR / Dãy số</th>
                                                <th className="px-3 py-2.5 text-right">Trọng lượng</th>
                                                <th className="px-3 py-2.5 text-center">Thời gian</th>
                                                <th className="px-3 py-2.5 text-center w-10">Gỡ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {filteredBoxes.map((box, idx) => {
                                                const boxNum = getBoxNumber(box)
                                                const isStamp = box.metadata?.scan_type === 'stamp' || !!box.metadata?.stamp_line1
                                                const stampL1 = box.metadata?.stamp_line1 || ''
                                                const stampL2 = box.metadata?.stamp_line2 || ''
                                                const sku = box.metadata?.sku || box.products?.sku || '---'
                                                const lotNum = box.semi_finished_lot_code || box.finished_lot_code || box.metadata?.lot_code || '---'

                                                return (
                                                    <tr key={box.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                        <td className="px-3 py-2 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                                                            #{boxNum}
                                                        </td>
                                                        <td className="px-3 py-2 font-mono font-medium text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                                                            {box.code}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            {isStamp ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                                    Dấu đóng
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                                    Tem OCR
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {isStamp ? (
                                                                <div className="font-mono text-[11px] leading-tight space-y-0.5">
                                                                    <div>D1: <span className="font-bold text-slate-900 dark:text-white">{stampL1}</span></div>
                                                                    <div>D2: <span className="font-bold text-slate-900 dark:text-white">{stampL2}</span></div>
                                                                </div>
                                                            ) : (
                                                                <div className="text-[11px] leading-tight">
                                                                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                                                                        SKU: {sku} • Lô: {lotNum}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400">
                                                                        Tổ: {box.metadata?.shift_group || '---'} • Vùng: {box.metadata?.region || '---'} • Ngày: {box.metadata?.packaging_date || '---'}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                            {box.quantity} {box.unit}
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                                            {new Date(box.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button
                                                                onClick={() => handleUnlink(box.id, box.code)}
                                                                disabled={isUnlinking === box.id}
                                                                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                                title="Gỡ thùng"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="text-center py-16 px-4 space-y-4 max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto shadow-inner">
                                <Smartphone size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                    Chưa có dữ liệu quét OCR từ điện thoại
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Lô này có STT là <span className="font-bold text-amber-600 dark:text-amber-400">{sttDisplay || '(chưa đặt)'}</span>.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-left space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                                    📌 Hướng dẫn thao tác kết nối:
                                </div>
                                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                                    <li>Mở ứng dụng <strong>Pallet Box Scanner</strong> trên điện thoại.</li>
                                    <li>Tại màn hình <strong>Quét Tem</strong> hoặc <strong>Dấu Đóng</strong>, nhập mã Pallet/STT là <strong className="text-amber-600 dark:text-amber-400 font-mono">{sttDisplay || 'STT của Lô này'}</strong>.</li>
                                    <li>Tiến hành quét các thùng hàng (thường 30 thùng/pallet).</li>
                                    <li>Bấm <strong>Đồng bộ lên Web</strong>. Hệ thống sẽ tự động đối chiếu STT và kết nối toàn bộ dữ liệu quét vào đây!</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Footer */}
                <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-850/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Smartphone size={13} className="text-indigo-500" />
                        <span>Đồng bộ tự động qua STT từ ứng dụng di động</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
