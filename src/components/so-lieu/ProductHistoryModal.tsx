'use client'

import React from 'react'
import { ArrowDownLeft, ArrowUpRight, Eye, Images, Pencil, Trash2, X } from 'lucide-react'
import type { OperationImageRecord } from '@/lib/operationImages'

interface ProductHistoryModalProps {
    product: any
    allJobJournals: any[]
    journalList: any[]
    historyModalTab: 'history' | 'images'
    setHistoryModalTab: (tab: 'history' | 'images') => void
    historyProductFilter: 'all' | 'in' | 'out'
    setHistoryProductFilter: (f: 'all' | 'in' | 'out') => void
    historyProductImages: OperationImageRecord[]
    historyImagesLoading: boolean
    getProductUnits: (p: any) => string[]
    getProductCount: (productName: string, unit?: string) => { inQty: number; outQty: number }
    cleanUserNotes: (notes?: string | null) => string
    formatDateTime: (iso?: string | null) => string
    onClose: () => void
    onStartEdit: (record: any) => void
    onDeleteJournal: (id: string) => void
    onPreviewImage: (img: OperationImageRecord) => void
}

/** Modal xem lịch sử nhập/xuất và hình ảnh riêng của một sản phẩm. */
export default function ProductHistoryModal({
    product,
    allJobJournals,
    journalList,
    historyModalTab,
    setHistoryModalTab,
    historyProductFilter,
    setHistoryProductFilter,
    historyProductImages,
    historyImagesLoading,
    getProductUnits,
    getProductCount,
    cleanUserNotes,
    formatDateTime,
    onClose,
    onStartEdit,
    onDeleteJournal,
    onPreviewImage,
}: ProductHistoryModalProps) {
    if (!product) return null

    const baseLines = allJobJournals.length > 0 ? allJobJournals : journalList
    const productLines = baseLines.filter(
        l => l.item_name === product.name || (l.notes && l.notes.includes(product.id))
    )

    const units = getProductUnits(product)
    const activeUnits = units.filter(u => {
        const s = getProductCount(product.name, u)
        return s.inQty > 0 || s.outQty > 0
    })
    const displayUnits = activeUnits.length > 0 ? activeUnits : [product.unit || 'Kg']

    const inLines = productLines.filter(l => l.to_department === 'Kho')
    const outLines = productLines.filter(l => l.to_department !== 'Kho')
    const filtered =
        historyProductFilter === 'in'
            ? inLines
            : historyProductFilter === 'out'
              ? outLines
              : productLines

    const filteredImgs =
        historyProductFilter === 'all'
            ? historyProductImages
            : historyProductImages.filter(img => img.direction === historyProductFilter)

    return (
        <div
            className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200 dark:border-zinc-800 shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-0.5">
                            <Eye className="w-3.5 h-3.5" /> Lịch sử nhập xuất sản phẩm
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-stone-900 dark:text-white leading-snug break-words">
                            {product.name}
                        </h3>
                        {product.sku && (
                            <p className="text-[11px] text-stone-400 font-mono mt-0.5">SKU: {product.sku}</p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 flex items-center justify-center transition shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="py-2.5 px-3 bg-stone-50 dark:bg-zinc-800/50 rounded-xl my-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                    <span className="font-bold text-stone-500 dark:text-stone-400">Tổng đã phát sinh:</span>
                    <div className="flex flex-wrap gap-2">
                        {displayUnits.map(u => {
                            const s = getProductCount(product.name, u)
                            return (
                                <div key={u} className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-zinc-900 rounded-lg border border-stone-200 dark:border-zinc-700 font-bold">
                                    <span className="text-stone-600 dark:text-stone-300">{u}:</span>
                                    <span className="text-emerald-600 dark:text-emerald-400">+{s.inQty}</span>
                                    <span className="text-stone-300 dark:text-zinc-600">/</span>
                                    <span className="text-rose-600 dark:text-rose-400">-{s.outQty}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl mb-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setHistoryModalTab('history')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                            historyModalTab === 'history'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                        }`}
                    >
                        Lịch sử ({productLines.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setHistoryModalTab('images')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                            historyModalTab === 'images'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                        }`}
                    >
                        <Images className="w-3.5 h-3.5" /> Hình ảnh ({historyProductImages.length})
                    </button>
                </div>

                <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-zinc-800/80 rounded-xl mb-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => setHistoryProductFilter('all')}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                            historyProductFilter === 'all'
                                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                        }`}
                    >
                        Tất cả ({historyModalTab === 'images' ? historyProductImages.length : productLines.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setHistoryProductFilter('in')}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                            historyProductFilter === 'in'
                                ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                        }`}
                    >
                        <ArrowDownLeft className="w-3.5 h-3.5" /> Nhập ({historyModalTab === 'images' ? historyProductImages.filter(i => i.direction === 'in').length : inLines.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setHistoryProductFilter('out')}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1 ${
                            historyProductFilter === 'out'
                                ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                        }`}
                    >
                        <ArrowUpRight className="w-3.5 h-3.5" /> Xuất ({historyModalTab === 'images' ? historyProductImages.filter(i => i.direction === 'out').length : outLines.length})
                    </button>
                </div>

                {historyModalTab === 'images' ? (
                    <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                        {historyImagesLoading ? (
                            <div className="py-10 text-center text-xs text-stone-400">Đang tải hình ảnh...</div>
                        ) : filteredImgs.length === 0 ? (
                            <div className="py-10 text-center text-xs text-stone-400">Chưa có hình ảnh nào phù hợp.</div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-2">
                                {filteredImgs.map(img => (
                                    <button
                                        key={img.id}
                                        type="button"
                                        onClick={() => onPreviewImage(img)}
                                        className="group relative aspect-square rounded-xl overflow-hidden border border-stone-200 dark:border-zinc-800 bg-stone-100 dark:bg-zinc-800 text-left"
                                    >
                                        <img src={img.public_url} alt={img.item_name || ''} className="w-full h-full object-cover group-hover:scale-105 transition" />
                                        <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-black text-white ${img.direction === 'in' ? 'bg-emerald-600/90' : 'bg-rose-600/90'}`}>
                                            {img.direction === 'in' ? 'NHẬP' : 'XUẤT'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800 -mx-4 sm:-mx-6 px-4 sm:px-6">
                        {filtered.length === 0 ? (
                            <div className="py-10 text-center text-xs text-stone-400">
                                Chưa có đợt nhập/xuất nào cho sản phẩm này.
                            </div>
                        ) : (
                            filtered.map(record => {
                                const isImport = record.to_department === 'Kho'
                                const userNote = cleanUserNotes(record.notes)
                                return (
                                    <div
                                        key={record.id}
                                        className="py-2.5 flex items-start gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 text-xs transition"
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                            isImport
                                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {isImport ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                        </div>

                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`px-2 py-0.5 rounded-md font-black text-xs tabular-nums ${
                                                    isImport
                                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                }`}>
                                                    {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onClose()
                                                            onStartEdit(record)
                                                        }}
                                                        title="Chỉnh sửa đợt này"
                                                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 text-stone-500 hover:text-indigo-600 flex items-center justify-center"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteJournal(record.id)}
                                                        title="Xóa đợt này"
                                                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 text-stone-500 hover:text-rose-600 flex items-center justify-center"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-[11px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                                <span>{formatDateTime(record.sent_at)}</span>
                                                <span>•</span>
                                                <span>{record.sent_by_name || 'Nhân viên'}</span>
                                                {userNote && <span className="text-stone-600 dark:text-stone-300 font-medium">💬 {userNote}</span>}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                <div className="pt-3 border-t border-stone-200 dark:border-zinc-800 mt-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full h-9 rounded-xl bg-stone-100 dark:bg-zinc-800 hover:bg-stone-200 dark:hover:bg-zinc-700 text-stone-700 dark:text-stone-200 text-xs font-bold transition"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    )
}
