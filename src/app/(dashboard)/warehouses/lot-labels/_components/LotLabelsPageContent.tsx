'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import {
    Search, RefreshCw, Layers, Trash2, X,
    Package, QrCode, Loader2, Tag, ArrowLeft,
    ScanLine, Link2
} from 'lucide-react'
import { advancedMatchSearch } from '@/lib/searchUtils'

interface BoxLabel {
    id: string
    code: string
    quantity: number
    unit: string
    status: string
    semi_finished_lot_code: string | null
    finished_lot_code: string | null
    products: {
        name: string
        sku: string
        internal_name: string | null
    } | null
}

interface LotWithLabels {
    id: string
    code: string
    production_code: string | null
    system_code: string
    created_at: string
    inbound_date: string | null
    products: { name: string; sku: string } | null
    box_labels: BoxLabel[]
}

// ─── Utility ───────────────────────────────────────────────────────────────
function getBoxIndex(code: string): string {
    if (!code) return '---'
    const parts = code.trim().split('-')
    const last = parts[parts.length - 1]
    return !isNaN(Number(last)) ? last : code
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse bg-stone-100 dark:bg-zinc-800 rounded-xl ${className}`} />
}

// ─── Empty State ───────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-center">
                <Icon size={28} className="text-stone-300 dark:text-zinc-600" />
            </div>
            <div>
                <p className="font-bold text-sm text-stone-700 dark:text-zinc-300">{title}</p>
                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-xs mx-auto leading-relaxed">{desc}</p>
            </div>
        </div>
    )
}

// ─── Label Row ─────────────────────────────────────────────────────────────
function LabelRow({
    label,
    idx,
    searchTerm,
    isUnlinking,
    onUnlink,
    isJustLinked = false,
}: {
    label: BoxLabel
    idx: number
    searchTerm: string
    isUnlinking: boolean
    onUnlink: () => void
    isJustLinked?: boolean
}) {
    const isMatched = useMemo(() => {
        if (!searchTerm) return false
        const vals = [
            label.code,
            label.semi_finished_lot_code || '',
            label.finished_lot_code || '',
            label.products?.name || '',
            label.products?.sku || '',
            label.products?.internal_name || '',
        ]
        return advancedMatchSearch(vals, searchTerm)
    }, [label, searchTerm])

    const prodName = label.products
        ? (label.products.internal_name || label.products.name)
        : 'Không rõ'
    const boxIdx = getBoxIndex(label.code)

    return (
        <div
            id={`label-row-${label.id}`}
            className={`flex items-center gap-3 px-3 py-3 rounded-2xl border transition-all duration-300 ${isJustLinked
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                    : isMatched
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
                        : 'bg-white dark:bg-zinc-900 border-stone-100 dark:border-zinc-800 hover:border-stone-200 dark:hover:border-zinc-700'
                }`}
        >
            {/* STT badge */}
            <div className="w-9 h-9 rounded-xl bg-stone-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-stone-500 dark:text-zinc-400 tabular-nums">#{boxIdx}</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-stone-800 dark:text-zinc-100 uppercase truncate">
                        {label.code}
                    </span>
                    {isJustLinked && (
                        <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-md animate-pulse">Vừa gán</span>
                    )}
                    {isMatched && (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black uppercase rounded-md">Khớp</span>
                    )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                    {label.finished_lot_code && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold border border-emerald-100 dark:border-emerald-800 rounded-md uppercase">
                            TP: {label.finished_lot_code}
                        </span>
                    )}
                    {label.semi_finished_lot_code && (
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[9px] font-bold border border-blue-100 dark:border-blue-800 rounded-md uppercase">
                            BTP: {label.semi_finished_lot_code}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 truncate">{prodName}</p>
            </div>

            {/* Weight */}
            <div className="text-right shrink-0">
                <span className="font-bold text-sm text-stone-900 dark:text-zinc-100 tabular-nums">{label.quantity}</span>
                <span className="text-[10px] text-stone-400 dark:text-zinc-500 ml-0.5">{label.unit}</span>
            </div>

            {/* Unlink */}
            <button
                type="button"
                disabled={isUnlinking}
                onClick={onUnlink}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 transition-all active:scale-90 shrink-0 disabled:opacity-50 cursor-pointer"
                title="Gỡ liên kết tem"
            >
                {isUnlinking ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
        </div>
    )
}

// ─── Lot Card (in list panel) ───────────────────────────────────────────────
function LotListCard({
    lot,
    isSelected,
    onClick,
}: {
    lot: LotWithLabels
    isSelected: boolean
    onClick: () => void
}) {
    const count = lot.box_labels?.length ?? 0
    const totalWeight = lot.box_labels?.reduce((s, l) => s + (parseFloat(String(l.quantity)) || 0), 0) ?? 0
    const unit = lot.box_labels?.[0]?.unit || 'Kg'
    const dateStr = lot.inbound_date
        ? new Date(lot.inbound_date).toLocaleDateString('vi-VN')
        : new Date(lot.created_at).toLocaleDateString('vi-VN')

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-4 py-3.5 border-b border-stone-100 dark:border-zinc-800 transition-all duration-150 active:scale-[0.98] ${isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500'
                    : 'bg-white dark:bg-zinc-900 hover:bg-stone-50 dark:hover:bg-zinc-800/60'
                }`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-stone-900 dark:text-zinc-100 uppercase truncate">
                            {lot.code}
                        </span>
                        {count > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border shrink-0 ${isSelected
                                    ? 'bg-emerald-500 text-white border-emerald-600'
                                    : 'bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400 border-stone-200 dark:border-zinc-700'
                                }`}>
                                {count} tem
                            </span>
                        )}
                    </div>
                    {lot.products && (
                        <p className="text-[11px] text-stone-400 dark:text-zinc-500 truncate mt-0.5">{lot.products.name}</p>
                    )}
                    <p className="text-[10px] text-stone-300 dark:text-zinc-600 mt-0.5">{dateStr}</p>
                </div>
                <div className="text-right shrink-0">
                    {count > 0 ? (
                        <div>
                            <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{totalWeight.toFixed(1)}</div>
                            <div className="text-[10px] text-stone-400">{unit}</div>
                        </div>
                    ) : (
                        <span className="text-[11px] text-stone-300 dark:text-zinc-600 italic">Trống</span>
                    )}
                </div>
            </div>
        </button>
    )
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function LotLabelsPageContent() {
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [lots, setLots] = useState<LotWithLabels[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchPallet, setSearchPallet] = useState('')
    const [searchLabel, setSearchLabel] = useState('')
    const [selectedLot, setSelectedLot] = useState<LotWithLabels | null>(null)
    const [unlinkingId, setUnlinkingId] = useState<string | null>(null)
    const [isLinkingLabel, setIsLinkingLabel] = useState(false)
    const [justLinkedIds, setJustLinkedIds] = useState<Set<string>>(new Set())
    const [scanValue, setScanValue] = useState('')
    const scanInputRef = useRef<HTMLInputElement>(null)

    // Mobile: show detail panel
    const [showDetail, setShowDetail] = useState(false)

    const fetchData = useCallback(async () => {
        if (!currentSystem?.code) return
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    production_code,
                    system_code,
                    created_at,
                    inbound_date,
                    products ( name, sku ),
                    box_labels (
                        id,
                        code,
                        quantity,
                        unit,
                        status,
                        semi_finished_lot_code,
                        finished_lot_code,
                        products ( name, sku, internal_name )
                    )
                `)
                .eq('system_code', currentSystem.code)
                .not('box_labels', 'is', null)
                .order('created_at', { ascending: false })
                .limit(200)

            if (error) throw error

            // Only keep lots that have at least one box label
            const filtered = (data || []).filter(
                (l: any) => Array.isArray(l.box_labels) && l.box_labels.length > 0
            ) as LotWithLabels[]
            setLots(filtered)

            // Auto-select first lot if none selected
            if (filtered.length > 0 && !selectedLot) {
                setSelectedLot(filtered[0])
            }
        } catch (err: any) {
            showToast('Không thể tải dữ liệu: ' + err.message, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [currentSystem?.code])

    useEffect(() => { fetchData() }, [fetchData])

    // Filtered pallet list
    const filteredLots = useMemo(() => {
        if (!searchPallet.trim()) return lots
        return lots.filter(lot => {
            const vals = [lot.code, lot.production_code || '', lot.products?.name || '', lot.products?.sku || '']
            return advancedMatchSearch(vals, searchPallet)
        })
    }, [lots, searchPallet])

    // Labels for selected lot, filtered by searchLabel
    const displayLabels = useMemo(() => {
        if (!selectedLot) return []
        if (!searchLabel.trim()) return selectedLot.box_labels
        return selectedLot.box_labels.filter(label => {
            const vals = [
                label.code,
                label.semi_finished_lot_code || '',
                label.finished_lot_code || '',
                label.products?.name || '',
                label.products?.sku || '',
                label.products?.internal_name || '',
            ]
            return advancedMatchSearch(vals, searchLabel)
        })
    }, [selectedLot, searchLabel])

    const totalWeight = selectedLot?.box_labels.reduce((s, l) => s + (parseFloat(String(l.quantity)) || 0), 0) ?? 0
    const displayUnit = selectedLot?.box_labels?.[0]?.unit || 'Kg'

    const handleUnlink = async (label: BoxLabel) => {
        const ok = window.confirm(`Gỡ tem "${label.code}" khỏi Pallet này?`)
        if (!ok) return

        setUnlinkingId(label.id)
        try {
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({ lot_id: null, status: 'printed' })
                .eq('id', label.id)
            if (error) throw error

            showToast(`Đã gỡ liên kết tem ${label.code}`, 'success')

            // Update local state
            setLots(prev => prev.map(lot => {
                if (lot.id !== selectedLot?.id) return lot
                const updatedLabels = lot.box_labels.filter(l => l.id !== label.id)
                const updatedLot = { ...lot, box_labels: updatedLabels }
                setSelectedLot(updatedLabels.length > 0 ? updatedLot : null)
                return updatedLot
            }).filter(lot => lot.box_labels.length > 0))
        } catch (err: any) {
            showToast('Lỗi gỡ liên kết: ' + err.message, 'error')
        } finally {
            setUnlinkingId(null)
        }
    }

    const handleSelectLot = (lot: LotWithLabels) => {
        setSelectedLot(lot)
        setSearchLabel('')
        setShowDetail(true)
        // Auto-focus scan input after selecting a lot
        setTimeout(() => scanInputRef.current?.focus(), 150)
    }

    const handleScanLink = useCallback(async (rawCode: string) => {
        if (!selectedLot || !currentSystem?.code) return
        setIsLinkingLabel(true)
        setScanValue('')
        try {
            const { data: labelData, error: findErr } = await supabase
                .from('box_labels')
                .select('id, code, lot_id, status, quantity, unit, semi_finished_lot_code, finished_lot_code, products(name, sku, internal_name)')
                .eq('system_code', currentSystem.code)
                .ilike('code', rawCode)
                .maybeSingle()

            if (findErr) throw findErr
            if (!labelData) { showToast(`Không tìm thấy tem: ${rawCode}`, 'error'); return }
            if ((labelData as any).lot_id === selectedLot.id) { showToast('Tem này đã gắn trên pallet rồi!', 'error'); return }

            let isTransferred = false
            if ((labelData as any).lot_id && (labelData as any).lot_id !== selectedLot.id) {
                isTransferred = true
            }

            const { error: updateErr } = await (supabase.from('box_labels') as any)
                .update({ lot_id: selectedLot.id, status: 'linked' })
                .eq('id', (labelData as any).id)
            if (updateErr) throw updateErr

            const newLabel = { ...(labelData as any), lot_id: selectedLot.id } as BoxLabel
            setSelectedLot(prev => {
                if (!prev) return prev
                const exists = prev.box_labels.some(l => l.id === newLabel.id)
                const updated = {
                    ...prev,
                    box_labels: exists
                        ? prev.box_labels.map(l => l.id === newLabel.id ? newLabel : l)
                        : [newLabel, ...prev.box_labels]
                }
                setLots(ls => ls.map(l => l.id === prev.id ? updated : l))
                return updated
            })
            setJustLinkedIds(s => new Set(s).add((labelData as any).id))
            setTimeout(() => setJustLinkedIds(s => { const ns = new Set(s); ns.delete((labelData as any).id); return ns }), 3000)
            
            const successMsg = isTransferred
                ? `✓ Đã chuyển: ${rawCode} → ${selectedLot.code}`
                : `✓ Liên kết: ${rawCode} → ${selectedLot.code}`
            showToast(successMsg, 'success')
            scanInputRef.current?.focus()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsLinkingLabel(false)
        }
    }, [selectedLot, currentSystem?.code])

    return (
        <div className="flex flex-col h-[calc(100vh-56px)]">
            {/* ── Page Header ── */}
            <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-white dark:bg-zinc-950 border-b border-stone-100 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                            <Layers size={20} className="text-emerald-500 shrink-0" />
                            Liên Kết Tem Thùng
                        </h1>
                        <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">
                            {currentSystem?.name} · {lots.length} pallet có tem
                        </p>
                    </div>
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Tải lại</span>
                    </button>
                </div>
            </div>

            {/* ── Main Content (2-panel layout) ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ═══ LEFT PANEL: Pallet List ═══════════════════════════════════════════ */}
                <div className={`flex flex-col border-r border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-950
                    ${showDetail ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex w-full lg:w-80 xl:w-96'}`}>

                    {/* Search bar */}
                    <div className="flex-shrink-0 p-3 border-b border-stone-100 dark:border-zinc-800">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 dark:text-zinc-600" />
                            <input
                                type="text"
                                value={searchPallet}
                                onChange={e => setSearchPallet(e.target.value)}
                                placeholder="Tìm pallet theo mã, sản phẩm..."
                                className="w-full pl-8 pr-8 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 rounded-xl text-xs font-medium text-stone-700 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-300 dark:focus:border-emerald-700 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                            />
                            {searchPallet && (
                                <button onClick={() => setSearchPallet('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="space-y-0">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="px-4 py-3.5 border-b border-stone-50">
                                        <Skeleton className="h-3.5 w-3/4 mb-2" />
                                        <Skeleton className="h-2.5 w-1/2" />
                                    </div>
                                ))}
                            </div>
                        ) : filteredLots.length === 0 ? (
                            <EmptyState
                                icon={Package}
                                title={searchPallet ? 'Không tìm thấy pallet' : 'Chưa có pallet nào có tem'}
                                desc={searchPallet ? 'Thử từ khóa khác hoặc xóa bộ lọc.' : 'Quét mã để liên kết tem thùng vào pallet.'}
                            />
                        ) : (
                            filteredLots.map(lot => (
                                <LotListCard
                                    key={lot.id}
                                    lot={lot}
                                    isSelected={selectedLot?.id === lot.id}
                                    onClick={() => handleSelectLot(lot)}
                                />
                            ))
                        )}
                    </div>

                    {/* Stats footer */}
                    {!isLoading && lots.length > 0 && (
                        <div className="flex-shrink-0 px-4 py-2.5 bg-stone-50 dark:bg-zinc-900 border-t border-stone-100 dark:border-zinc-800">
                            <p className="text-[10px] text-stone-400 dark:text-zinc-500 font-semibold">
                                {filteredLots.length} / {lots.length} pallet
                            </p>
                        </div>
                    )}
                </div>

                {/* ═══ RIGHT PANEL: Label Detail ══════════════════════════════════════════ */}
                <div className={`flex flex-col flex-1 bg-stone-50/50 dark:bg-zinc-900/50 overflow-hidden
                    ${showDetail ? 'flex' : 'hidden lg:flex'}`}>

                    {!selectedLot ? (
                        <EmptyState
                            icon={ScanLine}
                            title="Chọn pallet để xem tem"
                            desc="Chọn một pallet từ danh sách bên trái để xem danh sách tem thùng đã liên kết."
                        />
                    ) : (
                        <>
                            {/* Detail header */}
                            <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-zinc-950 border-b border-stone-100 dark:border-zinc-800">
                                {/* Mobile back button + title */}
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => setShowDetail(false)}
                                        className="lg:hidden mt-0.5 w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all shrink-0"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-black text-sm text-stone-900 dark:text-zinc-100 uppercase">
                                                {selectedLot.code}
                                            </span>
                                            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-black rounded-full">
                                                {selectedLot.box_labels.length} tem
                                            </span>
                                        </div>
                                        {selectedLot.products && (
                                            <p className="text-xs text-stone-400 dark:text-zinc-500 truncate mt-0.5">
                                                {selectedLot.products.name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Scan input for linking labels */}
                                <div className="mt-3">
                                    <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <ScanLine size={10} />
                                        Quét mã tem để liên kết vào pallet này
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                            {isLinkingLabel
                                                ? <Loader2 size={14} className="animate-spin text-emerald-500" />
                                                : <QrCode size={14} className="text-stone-300 dark:text-zinc-600" />}
                                        </div>
                                        <input
                                            ref={scanInputRef}
                                            type="text"
                                            value={scanValue}
                                            onChange={e => setScanValue(e.target.value.toUpperCase())}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && scanValue.trim()) {
                                                    handleScanLink(scanValue.trim())
                                                }
                                            }}
                                            placeholder="BOX-LXXXXXX-XXX... rồi Enter"
                                            disabled={isLinkingLabel}
                                            autoCapitalize="characters"
                                            className="w-full pl-8 pr-8 py-2.5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-xs font-mono font-bold text-stone-800 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-400 dark:focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase"
                                        />
                                        {scanValue && (
                                            <button onClick={() => setScanValue('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-2.5 text-center">
                                        <div className="text-base font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                                            {selectedLot.box_labels.length}
                                        </div>
                                        <div className="text-[9px] font-bold text-emerald-600/70 dark:text-emerald-500/70 uppercase tracking-wide mt-0.5">Tổng tem</div>
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-2.5 text-center">
                                        <div className="text-base font-black text-blue-700 dark:text-blue-400 tabular-nums">
                                            {totalWeight.toFixed(1)}
                                        </div>
                                        <div className="text-[9px] font-bold text-blue-600/70 dark:text-blue-500/70 uppercase tracking-wide mt-0.5">{displayUnit}</div>
                                    </div>
                                    <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl p-2.5 text-center">
                                        <div className="text-base font-black text-orange-700 dark:text-orange-400 tabular-nums">
                                            {selectedLot.box_labels.length > 0
                                                ? (totalWeight / selectedLot.box_labels.length).toFixed(1)
                                                : '0'}
                                        </div>
                                        <div className="text-[9px] font-bold text-orange-600/70 dark:text-orange-500/70 uppercase tracking-wide mt-0.5">TB/tem</div>
                                    </div>
                                </div>

                                {/* Label search */}
                                <div className="mt-3 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300 dark:text-zinc-600" />
                                    <input
                                        type="text"
                                        value={searchLabel}
                                        onChange={e => setSearchLabel(e.target.value)}
                                        placeholder="Tìm tem trong pallet này..."
                                        className="w-full pl-8 pr-8 py-2.5 bg-stone-50 dark:bg-zinc-900 border border-stone-100 dark:border-zinc-800 rounded-xl text-xs font-medium text-stone-700 dark:text-zinc-200 placeholder-stone-300 dark:placeholder-zinc-600 focus:outline-none focus:border-emerald-300 dark:focus:border-emerald-700 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                                    />
                                    {searchLabel && (
                                        <button onClick={() => setSearchLabel('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500 transition-colors">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>

                                {/* Search result hint */}
                                {searchLabel && (
                                    <div className="mt-2 px-1 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                        <span className="text-[10px] text-stone-400 dark:text-zinc-500">
                                            {displayLabels.length}/{selectedLot.box_labels.length} tem khớp
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Label list */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {displayLabels.length === 0 ? (
                                    <EmptyState
                                        icon={Tag}
                                        title="Không có tem khớp"
                                        desc="Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm."
                                    />
                                ) : (
                                    displayLabels.map((label, idx) => (
                                        <LabelRow
                                            key={label.id}
                                            label={label}
                                            idx={idx}
                                            searchTerm={searchLabel}
                                            isUnlinking={unlinkingId === label.id}
                                            onUnlink={() => handleUnlink(label)}
                                            isJustLinked={justLinkedIds.has(label.id)}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex-shrink-0 px-4 py-2.5 bg-white dark:bg-zinc-950 border-t border-stone-100 dark:border-zinc-800">
                                <p className="text-[10px] text-stone-400 dark:text-zinc-500 font-semibold">
                                    {displayLabels.length} / {selectedLot.box_labels.length} tem hiển thị
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
