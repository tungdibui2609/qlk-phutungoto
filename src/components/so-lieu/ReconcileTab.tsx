'use client'

import React from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Camera } from 'lucide-react'
import type { OperationImageRecord } from '@/lib/operationImages'

export interface ReconcileEntry {
    startStr: string
    endStr: string
    calcType: 'diff' | 'inclusive'
    targetType: 'in' | 'out' | 'net'
    isManualTarget?: boolean
    note?: string
}

export interface ReconcileSummaryRow {
    product_name: string
    unit: string
    in_qty: number
    out_qty: number
    count: number
    isTotal?: boolean
}

interface ReconcileTabProps {
    summarizedRows: ReconcileSummaryRow[]
    pinnedProducts: any[]
    getProductUnits: (p: any) => string[]
    reconcileMap: Record<string, ReconcileEntry>
    setReconcileMap: React.Dispatch<React.SetStateAction<Record<string, ReconcileEntry>>>
    reconcileImagesMap: Record<string, { start: OperationImageRecord[]; end: OperationImageRecord[] }>
    uploadingReconcileKey: string | null
    savingReconcile: boolean
    expandedReconcileKeys: Record<string, boolean>
    setExpandedReconcileKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
    onSaveReconcile: () => void
    onUploadReconcileImages: (
        reconcileKey: string,
        phase: 'start' | 'end',
        itemName: string,
        unit: string,
        fileList: FileList | null
    ) => void
    onPreviewImage: (img: OperationImageRecord) => void
}

/** Tab Đối chiếu / Tham chiếu Số đầu – Số đuôi cho màn hình Số liệu (Web). */
export default function ReconcileTab({
    summarizedRows,
    pinnedProducts,
    getProductUnits,
    reconcileMap,
    setReconcileMap,
    reconcileImagesMap,
    uploadingReconcileKey,
    savingReconcile,
    expandedReconcileKeys,
    setExpandedReconcileKeys,
    onSaveReconcile,
    onUploadReconcileImages,
    onPreviewImage,
}: ReconcileTabProps) {
    const existingKeys = new Set(summarizedRows.map(r => `${r.product_name}___${r.unit}`))
    const existingNames = new Set(summarizedRows.map(r => r.product_name.trim().toLowerCase()))

    // Tự động đưa các SP đang ghim trên bàn làm việc (từ đầu ca hoặc mới thêm giữa ca) vào danh sách đối chiếu
    const pinnedRows: ReconcileSummaryRow[] = pinnedProducts
        .filter(p => p.name && !existingNames.has(p.name.trim().toLowerCase()))
        .map(p => {
            const unit = getProductUnits(p)[0] || p.unit || 'ĐVT'
            return { product_name: p.name, unit, in_qty: 0, out_qty: 0, count: 0 }
        })
        .filter(r => {
            const k = `${r.product_name}___${r.unit}`
            if (existingKeys.has(k)) return false
            existingKeys.add(k)
            existingNames.add(r.product_name.trim().toLowerCase())
            return true
        })

    const preDeclaredRows: ReconcileSummaryRow[] = Object.keys(reconcileMap)
        .filter(k => k !== '__TOTAL__' && !existingKeys.has(k) && k.includes('___'))
        .map(k => {
            const [product_name, unit] = k.split('___')
            return { product_name, unit, in_qty: 0, out_qty: 0, count: 0 }
        })

    const productRows = [...summarizedRows, ...pinnedRows, ...preDeclaredRows]
    const totalIn = Math.round(summarizedRows.reduce((s, r) => s + r.in_qty, 0) * 1000) / 1000
    const totalOut = Math.round(summarizedRows.reduce((s, r) => s + r.out_qty, 0) * 1000) / 1000
    const totalCount = summarizedRows.reduce((s, r) => s + r.count, 0)

    const rows: ReconcileSummaryRow[] = [
        {
            product_name: 'Tổng tất cả sản phẩm (Đối chiếu tổng)',
            unit: 'Tổng cả việc',
            in_qty: totalIn,
            out_qty: totalOut,
            count: totalCount,
            isTotal: true,
        },
        ...productRows,
    ]

    const updateEntry = (key: string, defaultTarget: 'in' | 'out' | 'net', patch: Partial<ReconcileEntry>) => {
        setReconcileMap(prev => {
            const cur = prev[key] || { startStr: '', endStr: '', calcType: 'diff' as const, targetType: defaultTarget, note: '' }
            return { ...prev, [key]: { ...cur, ...patch } }
        })
    }

    const allExpanded = rows.every(r => !!expandedReconcileKeys[r.isTotal ? '__TOTAL__' : `${r.product_name}___${r.unit}`])

    return (
        <div className="p-3 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-200 dark:border-zinc-800">
                <div>
                    <h4 className="text-sm font-black text-stone-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-500" />
                        Đối chiếu Số đầu – Số đuôi
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        Dữ liệu đối chiếu độc lập (theo tổng cả việc hoặc từng sản phẩm), không cộng vào số lượng nhập/xuất hệ thống.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            if (allExpanded) {
                                setExpandedReconcileKeys({})
                            } else {
                                const next: Record<string, boolean> = {}
                                rows.forEach(r => {
                                    next[r.isTotal ? '__TOTAL__' : `${r.product_name}___${r.unit}`] = true
                                })
                                setExpandedReconcileKeys(next)
                            }
                        }}
                        className="px-2.5 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-stone-50 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300 text-xs font-semibold transition"
                    >
                        {allExpanded ? 'Thu gọn' : 'Mở tất cả'}
                    </button>
                    <button
                        type="button"
                        disabled={savingReconcile}
                        onClick={onSaveReconcile}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50"
                    >
                        {savingReconcile ? 'Đang lưu...' : 'Lưu đối chiếu'}
                    </button>
                </div>
            </div>

            <div className="space-y-2.5">
                {rows.map((row) => {
                    const key = row.isTotal ? '__TOTAL__' : `${row.product_name}___${row.unit}`
                    const defaultTarget: 'in' | 'out' | 'net' =
                        row.in_qty > 0 && row.out_qty > 0
                            ? 'net'
                            : row.out_qty > 0 && row.in_qty === 0
                                ? 'out'
                                : 'in'
                    const rawEntry = reconcileMap[key]
                    const entry: ReconcileEntry = rawEntry
                        ? {
                              ...rawEntry,
                              targetType: rawEntry.isManualTarget ? rawEntry.targetType : defaultTarget,
                          }
                        : {
                              startStr: '',
                              endStr: '',
                              calcType: 'diff' as const,
                              targetType: defaultTarget,
                              note: '',
                          }
                    const s = parseFloat((entry.startStr || '').replace(',', '.'))
                    const e = parseFloat((entry.endStr || '').replace(',', '.'))
                    const hasNums = entry.startStr.trim() !== '' && entry.endStr.trim() !== '' && !Number.isNaN(s) && !Number.isNaN(e)
                    const rawDiff = hasNums ? Math.abs(e - s) : 0
                    const calcQty = hasNums ? Math.round((entry.calcType === 'inclusive' ? rawDiff + 1 : rawDiff) * 1000) / 1000 : 0
                    const sysQty = entry.targetType === 'in' ? row.in_qty : entry.targetType === 'out' ? row.out_qty : Math.abs(row.in_qty - row.out_qty)
                    const delta = hasNums ? Math.round((calcQty - sysQty) * 1000) / 1000 : 0
                    const isMatched = hasNums && delta === 0
                    const isExpanded = !!expandedReconcileKeys[key]

                    return (
                        <div
                            key={key}
                            className={`rounded-2xl border overflow-hidden transition ${
                                row.isTotal
                                    ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/25'
                                    : 'border-stone-200 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-950/60'
                            }`}
                        >
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setExpandedReconcileKeys(prev => ({ ...prev, [key]: !prev[key] }))}
                                onKeyDown={ev => {
                                    if (ev.key === 'Enter' || ev.key === ' ') {
                                        ev.preventDefault()
                                        setExpandedReconcileKeys(prev => ({ ...prev, [key]: !prev[key] }))
                                    }
                                }}
                                className="w-full p-3 text-left flex flex-wrap items-center justify-between gap-2 hover:bg-black/2 dark:hover:bg-white/2 transition cursor-pointer"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs sm:text-sm font-bold text-stone-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                        {row.isTotal && <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px] font-extrabold shrink-0">TỔNG</span>}
                                        <span className="truncate">{row.product_name}</span>
                                        {!row.isTotal && <span className="text-stone-400 font-semibold shrink-0">({row.unit})</span>}
                                    </p>
                                    <div className="text-[11px] text-stone-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span>Hệ thống Nhập: <strong className="text-emerald-600">+{row.in_qty}</strong></span>
                                        <span>•</span>
                                        <span>Xuất: <strong className="text-rose-600">-{row.out_qty}</strong></span>
                                        {(entry.startStr.trim() !== '' || entry.endStr.trim() !== '') && (
                                            <>
                                                <span>•</span>
                                                <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                                    Đầu: {entry.startStr || '—'} / Đuôi: {entry.endStr || '—'}
                                                </span>
                                            </>
                                        )}
                                        {((reconcileImagesMap[key]?.start.length || 0) > 0 || (reconcileImagesMap[key]?.end.length || 0) > 0) && (
                                            <>
                                                <span>•</span>
                                                <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                                                    📷 Đầu: {reconcileImagesMap[key]?.start.length || 0} / Cuối: {reconcileImagesMap[key]?.end.length || 0}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="flex items-center gap-2 shrink-0"
                                    onClick={ev => ev.stopPropagation()}
                                >
                                    <select
                                        value={entry.calcType}
                                        onChange={ev => updateEntry(key, defaultTarget, { calcType: ev.target.value as any })}
                                        className="h-8 px-2 rounded-xl border border-amber-200 dark:border-amber-800/70 bg-white dark:bg-zinc-900 text-xs font-bold text-amber-700 dark:text-amber-300"
                                    >
                                        <option value="diff">Đếm Tồn (Đuôi - Đầu)</option>
                                        <option value="inclusive">Đếm STT (Đuôi - Đầu + 1)</option>
                                    </select>
                                    {!isExpanded && hasNums && (
                                        <span className={`px-2 py-1 rounded-full text-[11px] font-black ${
                                            isMatched
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                        }`}>
                                            {isMatched ? `✓ Khớp (${calcQty})` : `⚠ Lệch ${delta > 0 ? `+${delta}` : delta}`}
                                        </span>
                                    )}
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-stone-400" />
                                        : <ChevronRight className="w-4 h-4 text-stone-400" />}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-3 pb-3 pt-2 border-t border-stone-200/70 dark:border-zinc-800/70 space-y-2.5">
                                    {row.isTotal && (
                                        <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                                            VD: Đầu ca có 3 pallet không ngoài sảnh, cuối ca đếm được 10 pallet không → phát sinh 7 để so với tổng các SP của công việc.
                                        </p>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                                        <div className="col-span-2 sm:col-span-3">
                                            <label className="block text-[10px] font-bold text-stone-500 mb-1">So với</label>
                                            <select
                                                value={entry.targetType}
                                                onChange={ev => updateEntry(key, defaultTarget, { targetType: ev.target.value as any, isManualTarget: true })}
                                                className="w-full h-9 px-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-stone-800 dark:text-stone-200"
                                            >
                                                <option value="in">Tổng Nhập (+{row.in_qty})</option>
                                                <option value="out">Tổng Xuất (-{row.out_qty})</option>
                                                <option value="net">Cân đối ({Math.abs(row.in_qty - row.out_qty)})</option>
                                            </select>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-bold text-stone-500 mb-1">Số đầu</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={entry.startStr}
                                                onChange={ev => updateEntry(key, defaultTarget, { startStr: ev.target.value })}
                                                placeholder="VD: 6"
                                                className="w-full h-9 px-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-black text-stone-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-bold text-stone-500 mb-1">Số đuôi</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={entry.endStr}
                                                onChange={ev => updateEntry(key, defaultTarget, { endStr: ev.target.value })}
                                                placeholder="VD: 12"
                                                className="w-full h-9 px-2.5 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-black text-stone-900 dark:text-white"
                                            />
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[10px] font-bold text-stone-500 mb-1">Kết quả</label>
                                            <div className="w-full h-9 px-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 flex items-center justify-center text-sm font-black text-amber-700 dark:text-amber-300">
                                                {hasNums ? calcQty : '—'}
                                            </div>
                                        </div>
                                        <div className="sm:col-span-3">
                                            <label className="block text-[10px] font-bold text-stone-500 mb-1">Tham chiếu</label>
                                            {hasNums ? (
                                                <div className={`w-full h-9 px-2.5 rounded-xl flex items-center justify-center text-xs font-black ${
                                                    isMatched
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                                }`}>
                                                    {isMatched ? '✓ Khớp' : `⚠ Lệch ${delta > 0 ? `+${delta}` : delta}`}
                                                </div>
                                            ) : (
                                                <div className="w-full h-9 px-2 rounded-xl flex items-center justify-center text-[11px] font-medium text-stone-400 bg-stone-100/80 dark:bg-zinc-900 border border-dashed border-stone-200 dark:border-zinc-700">
                                                    Chờ số...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            value={entry.note || ''}
                                            onChange={ev => updateEntry(key, defaultTarget, { note: ev.target.value })}
                                            placeholder="Ghi chú tham chiếu (tùy chọn)..."
                                            className="w-full h-9 px-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-stone-700 dark:text-stone-200"
                                        />
                                    </div>
                                    {/* Ảnh tham chiếu Đầu / Cuối cho thẻ này */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {([
                                            { phase: 'start' as const, label: 'Ảnh tham chiếu ĐẦU', badge: 'ĐẦU', badgeCls: 'bg-sky-600/90', btnCls: 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
                                            { phase: 'end' as const, label: 'Ảnh tham chiếu CUỐI', badge: 'CUỐI', badgeCls: 'bg-amber-600/90', btnCls: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
                                        ]).map(cfg => {
                                            const imgs = reconcileImagesMap[key]?.[cfg.phase] || []
                                            const isUp = uploadingReconcileKey === `${key}:${cfg.phase}`
                                            return (
                                                <div key={cfg.phase} className="rounded-xl border border-stone-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50 p-2.5 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300 flex items-center gap-1.5">
                                                            <Camera className="w-3.5 h-3.5 text-amber-500" />
                                                            {cfg.label} ({imgs.length})
                                                        </span>
                                                        <label className={`cursor-pointer px-2 py-1 rounded-lg border text-[11px] font-bold transition flex items-center gap-1 ${cfg.btnCls}`}>
                                                            <Camera className="w-3 h-3" />
                                                            <span>{isUp ? 'Đang tải...' : '+ Thêm'}</span>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                multiple
                                                                disabled={isUp}
                                                                className="hidden"
                                                                onChange={ev => {
                                                                    onUploadReconcileImages(key, cfg.phase, row.product_name, row.unit, ev.target.files)
                                                                    ev.target.value = ''
                                                                }}
                                                            />
                                                        </label>
                                                    </div>
                                                    {imgs.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {imgs.map(img => (
                                                                <button
                                                                    key={img.id}
                                                                    type="button"
                                                                    onClick={() => onPreviewImage(img)}
                                                                    className="relative w-12 h-12 rounded-lg overflow-hidden border border-stone-200 dark:border-zinc-700 hover:ring-2 hover:ring-amber-500 transition"
                                                                >
                                                                    <img src={img.public_url} alt={img.item_name || ''} className="w-full h-full object-cover" />
                                                                    <span className={`absolute bottom-0.5 right-0.5 px-1 rounded text-[8px] font-black text-white ${cfg.badgeCls}`}>
                                                                        {cfg.badge}
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="text-[10px] text-stone-500 dark:text-stone-400">
                                        {entry.calcType === 'diff'
                                            ? '💡 Đếm Tồn: Đầu ca có 6, cuối ca đếm được 12 → Phát sinh 6.'
                                            : '💡 Đếm STT: Làm từ số 6 đến số 12 (tính cả 2 đầu) → Tổng 7.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
